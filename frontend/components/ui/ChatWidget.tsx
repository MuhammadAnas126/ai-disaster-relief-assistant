'use client'

import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from 'react'
import Link from 'next/link'
import { LifeBuoy, MessageCircle, Send, Siren, Volume2, VolumeX, X } from 'lucide-react'
import { assistantApi, buildOfflineAssistantMessage } from '../../lib/api'
import { useLanguage } from '../../lib/i18n'
import type { TranslationKey } from '../../lib/dictionaries'
import { detectSpeechLang, pickSpeechVoice } from '../../lib/speech'
import type { AssistantContext, ChatMessage, SosPrefill } from '../../types'
import { TypingIndicator } from './TypingIndicator'
import { MarkdownText } from './Markdown'
import { cn } from '../../lib/utils'

const AUTO_READ_KEY = 'muhafiz-auto-read'

/** Server snapshot for the persisted auto-read setting — renders as off during
 *  SSR so hydration always matches. */
function serverSnapshotOff(): boolean {
  return false
}

/** Module-level store for the persisted auto-read setting. Reading it through
 *  useSyncExternalStore keeps hydration safe (the server snapshot is "off")
 *  and the React Compiler purity rules satisfied. */
const autoReadStore = {
  listeners: new Set<() => void>(),
  read(): boolean {
    return window.localStorage.getItem(AUTO_READ_KEY) === '1'
  },
  write(next: boolean) {
    window.localStorage.setItem(AUTO_READ_KEY, next ? '1' : '0')
    for (const listener of autoReadStore.listeners) listener()
  },
  subscribe(listener: () => void): () => void {
    autoReadStore.listeners.add(listener)
    return () => {
      autoReadStore.listeners.delete(listener)
    }
  },
}

/** Build the local user message — ids and timestamps live at module scope
 *  because the React Compiler purity rule forbids Date.now() inside
 *  component-scope helpers. */
function buildUserMessage(text: string): ChatMessage {
  return {
    id: `u-${Date.now()}`,
    role: 'user',
    text,
    sentAt: new Date().toISOString(),
  }
}

function buildOfflineMessage(context?: AssistantContext): ChatMessage {
  return {
    id: `err-${Date.now()}`,
    role: 'assistant',
    text: buildOfflineAssistantMessage(context),
    sentAt: new Date().toISOString(),
  }
}

/** Build the Register Your Case link for a 1-tap SOS card — every extracted
 *  field (description, place, people count, trapped status, GPS coords)
 *  travels as a query param so the form arrives pre-filled for review. */
function buildSosHref(prefill: SosPrefill): string {
  const params = new URLSearchParams()
  params.set('description', prefill.description)
  if (prefill.location) params.set('location', prefill.location)
  if (typeof prefill.peopleAffected === 'number' && prefill.peopleAffected >= 0) {
    params.set('peopleAffected', String(prefill.peopleAffected))
  }
  if (prefill.trapped && prefill.trapped !== 'no') params.set('trapped', prefill.trapped)
  if (typeof prefill.lat === 'number' && typeof prefill.lng === 'number') {
    params.set('lat', prefill.lat.toFixed(6))
    params.set('lng', prefill.lng.toFixed(6))
  }
  return `/register/case?${params.toString()}`
}

/** Quick-prompt chips shown in the empty state — one tap starts a core workflow. */
const QUICK_PROMPTS: { labelKey: TranslationKey; promptKey: TranslationKey }[] = [
  { labelKey: 'chat.quickFirstAid', promptKey: 'chat.quickFirstAidPrompt' },
  { labelKey: 'chat.quickFlood', promptKey: 'chat.quickFloodPrompt' },
  { labelKey: 'chat.quickSos', promptKey: 'chat.quickSosPrompt' },
  { labelKey: 'chat.quickHotlines', promptKey: 'chat.quickHotlinesPrompt' },
]

export function ChatWidget({ context }: { context?: AssistantContext }) {
  const { t, language } = useLanguage()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const [speakingId, setSpeakingId] = useState<string | null>(null)
  // Client-only setting — hydration-safe read through useSyncExternalStore.
  const autoRead = useSyncExternalStore(
    autoReadStore.subscribe,
    autoReadStore.read,
    serverSnapshotOff,
  )
  const scrollRef = useRef<HTMLDivElement>(null)
  const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const voicesRef = useRef<SpeechSynthesisVoice[]>([])

  // Voice lists load asynchronously in most browsers — the first getVoices()
  // call often returns nothing, which would leave Urdu messages on the
  // default (usually English) voice. Cache the list and refresh it whenever
  // the engine announces changes.
  useEffect(() => {
    const synth = window.speechSynthesis
    const loadVoices = () => {
      voicesRef.current = synth.getVoices()
    }
    loadVoices()
    synth.addEventListener('voiceschanged', loadVoices)
    return () => synth.removeEventListener('voiceschanged', loadVoices)
  }, [])

  // Live case context for the assistant — the widget always contributes the
  // UI language so replies default to it.
  const chatContext: AssistantContext = { ...context, language }

  // Keep the newest message in view.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, open])

  // Stop any read-aloud audio when the widget unmounts.
  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel()
    }
  }, [])

  /** Queue one assistant message on the speech synthesizer. */
  function speakMessage(msg: ChatMessage) {
    const utterance = new SpeechSynthesisUtterance(msg.text)
    // Keep the detected locale in a typed variable — utterance.lang widens to
    // plain string, which pickSpeechVoice's signature rejects. Urdu text is
    // spoken with an Urdu voice (Arabic fallback when none is installed).
    const lang = detectSpeechLang(msg.text)
    utterance.lang = lang
    const voice = pickSpeechVoice(voicesRef.current, lang)
    if (voice) utterance.voice = voice
    const handleStopped = () => {
      // Ignore stop events from utterances that are no longer the active one.
      if (activeUtteranceRef.current === utterance) {
        activeUtteranceRef.current = null
        setSpeakingId(null)
      }
    }
    utterance.onend = handleStopped
    utterance.onerror = handleStopped
    activeUtteranceRef.current = utterance
    setSpeakingId(msg.id)
    window.speechSynthesis.speak(utterance)
  }

  /** Read an assistant message aloud (or stop it when it is already playing). */
  function toggleSpeakMessage(msg: ChatMessage) {
    window.speechSynthesis.cancel()
    if (speakingId === msg.id) {
      activeUtteranceRef.current = null
      setSpeakingId(null)
      return
    }
    speakMessage(msg)
  }

  /** Toggle auto-read-aloud from the chat header settings. */
  function toggleAutoRead() {
    const next = !autoRead
    autoReadStore.write(next)
    if (!next) {
      // Turning auto-read off also stops anything currently playing.
      window.speechSynthesis.cancel()
      activeUtteranceRef.current = null
      setSpeakingId(null)
    }
  }

  async function sendMessage(text: string) {
    const trimmed = text.trim()
    if (!trimmed || loading) return

    const userMsg = buildUserMessage(trimmed)
    setMessages((m) => [...m, userMsg])
    setDraft('')
    setLoading(true)

    try {
      const reply = await assistantApi.send(trimmed, [...messages, userMsg], chatContext)
      setMessages((m) => [...m, reply])
      if (autoRead) speakMessage(reply)
    } catch {
      const offline = buildOfflineMessage(chatContext)
      setMessages((m) => [...m, offline])
      if (autoRead) speakMessage(offline)
    } finally {
      setLoading(false)
    }
  }

  function handleSend(e: FormEvent) {
    e.preventDefault()
    void sendMessage(draft)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-lg transition-transform hover:scale-105"
        aria-label={t('chat.open')}
      >
        <MessageCircle size={22} />
      </button>
    )
  }

  return (
    <div
      role="dialog"
      aria-label={t('chat.title')}
      className={cn(
        'fixed z-50 flex flex-col overflow-hidden border border-border bg-card shadow-2xl animate-chat-in',
        // Mobile: full-width bottom sheet. Desktop: anchored floating window.
        'inset-x-0 bottom-0 h-[85vh] origin-bottom rounded-t-2xl',
        'sm:inset-auto sm:bottom-6 sm:right-6 sm:h-[550px] sm:w-[420px] sm:origin-bottom-right sm:rounded-2xl',
      )}
    >
      {/* Header — assistant identity, auto-read setting, close */}
      <div className="flex items-center justify-between gap-2 bg-accent px-4 py-3 text-accent-foreground">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-black/20">
            <LifeBuoy size={18} />
          </div>
          <div>
            <span className="block text-sm font-semibold">{t('chat.title')}</span>
            <span className="block text-[11px] opacity-80">{t('chat.subtitle')}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={toggleAutoRead}
            aria-pressed={autoRead}
            aria-label={t('chat.autoRead')}
            title={t('chat.autoRead')}
            className={cn(
              'rounded-lg p-1.5 transition-colors',
              autoRead ? 'bg-white/25' : 'opacity-70 hover:bg-white/10 hover:opacity-100',
            )}
          >
            <Volume2 size={15} />
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={t('chat.close')}
            title={t('chat.close')}
            className="rounded-lg p-1.5 opacity-70 transition-colors hover:bg-white/10 hover:opacity-100"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-4 py-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/15 text-accent">
              <LifeBuoy size={22} />
            </div>
            <p className="max-w-[280px] text-xs leading-relaxed text-text-muted">{t('chat.empty')}</p>
            <div className="flex max-w-[300px] flex-wrap justify-center gap-2">
              {QUICK_PROMPTS.map(({ labelKey, promptKey }) => (
                <button
                  key={labelKey}
                  type="button"
                  onClick={() => void sendMessage(t(promptKey))}
                  className="rounded-full border border-border bg-bg px-3 py-1.5 text-xs font-medium text-text-muted transition-colors hover:border-secondary/60 hover:text-text"
                >
                  {t(labelKey)}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn('flex flex-col', msg.role === 'user' ? 'items-end' : 'items-start')}
          >
            <div
              className={cn(
                'max-w-[85%] whitespace-pre-line rounded-xl px-3 py-2 text-sm leading-relaxed',
                msg.role === 'user'
                  ? 'border border-border bg-bg text-text'
                  : 'bg-accent/15 text-text',
              )}
            >
              {msg.role === 'assistant' ? <MarkdownText text={msg.text} /> : msg.text}
            </div>

            {/* 1-tap SOS card — Muhafiz extracted the case details and
                pre-fills Register Your Case for review */}
            {msg.role === 'assistant' && msg.sosPrefill && (
              <Link
                href={buildSosHref(msg.sosPrefill)}
                className="mt-2 flex max-w-[85%] items-center gap-3 rounded-xl border border-accent/50 bg-accent/10 px-3 py-2.5 transition-colors hover:bg-accent/20"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <Siren size={15} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold text-text">
                    {t('chat.sosCardTitle')}
                  </span>
                  <span className="block text-[11px] font-medium text-accent">
                    {t('chat.sosCardAction')} →
                  </span>
                </span>
              </Link>
            )}

            {/* Read this reply aloud */}
            {msg.role === 'assistant' && (
              <button
                type="button"
                onClick={() => toggleSpeakMessage(msg)}
                aria-label={speakingId === msg.id ? t('chat.stopSpeaking') : t('chat.speakMessage')}
                title={speakingId === msg.id ? t('chat.stopSpeaking') : t('chat.speakMessage')}
                className={cn(
                  'mt-1 rounded-md p-1 transition-colors',
                  speakingId === msg.id ? 'text-secondary' : 'text-text-faint hover:text-text-muted',
                )}
              >
                {speakingId === msg.id ? <VolumeX size={13} /> : <Volume2 size={13} />}
              </button>
            )}
          </div>
        ))}
        {loading && <TypingIndicator className="max-w-[85%]" />}
      </div>

      {/* Input */}
      <form
        onSubmit={handleSend}
        className="flex gap-2 border-t border-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t('common.typeMessage')}
          className="min-w-0 flex-1 rounded-xl border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-faint outline-none focus:border-secondary"
        />
        <button
          type="submit"
          disabled={loading || !draft.trim()}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-accent-foreground transition-colors hover:bg-accent/90 disabled:opacity-40"
        >
          <Send size={14} />
        </button>
      </form>
    </div>
  )
}
