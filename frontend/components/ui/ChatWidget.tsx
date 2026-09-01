'use client'

import { useState, useRef, useEffect, type FormEvent } from 'react'
import { MessageCircle, X, Send } from 'lucide-react'
import { assistantApi, buildOfflineAssistantMessage } from '../../lib/api'
import { useLanguage } from '../../lib/i18n'
import type { AssistantContext, ChatMessage } from '../../types'
import { TypingIndicator } from './TypingIndicator'
import { MarkdownText } from './Markdown'
import { cn } from '../../lib/utils'

export function ChatWidget({ context }: { context?: AssistantContext }) {
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  async function handleSend(e: FormEvent) {
    e.preventDefault()
    if (!draft.trim() || loading) return

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: draft,
      sentAt: new Date().toISOString(),
    }
    setMessages((m) => [...m, userMsg])
    const text = draft
    setDraft('')
    setLoading(true)

    try {
      const reply = await assistantApi.send(text, [...messages, userMsg], context)
      setMessages((m) => [...m, reply])
    } catch {
      const offline: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        text: buildOfflineAssistantMessage(context),
        sentAt: new Date().toISOString(),
      }
      setMessages((m) => [...m, offline])
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-[1200] flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-lg transition-transform hover:scale-105"
        aria-label={t('chat.open')}
      >
        <MessageCircle size={22} />
      </button>
    )
  }

  return (
    <div className="fixed bottom-6 right-6 z-[1200] flex w-80 max-w-[calc(100vw-3rem)] origin-bottom-right animate-chat-in flex-col rounded-2xl border border-border bg-card shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between rounded-t-2xl bg-accent px-4 py-3 text-accent-foreground">
        <div>
          <span className="block text-sm font-semibold">{t('chat.title')}</span>
          <span className="block text-[11px] opacity-80">{t('chat.subtitle')}</span>
        </div>
        <button onClick={() => setOpen(false)} className="self-start opacity-70 hover:opacity-100" aria-label={t('chat.close')}>
          <X size={16} />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="max-h-72 space-y-2 overflow-y-auto p-3">
        {messages.length === 0 && (
          <p className="py-6 text-center text-xs text-text-faint">{t('chat.empty')}</p>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              'max-w-[85%] whitespace-pre-line rounded-xl px-3 py-2 text-sm leading-relaxed',
              msg.role === 'user'
                ? 'ml-auto border border-border bg-bg text-text'
                : 'bg-accent/15 text-text',
            )}
          >
            {msg.role === 'assistant' ? <MarkdownText text={msg.text} /> : msg.text}
          </div>
        ))}
        {loading && <TypingIndicator className="max-w-[85%]" />}
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="flex gap-2 border-t border-border p-3">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t('common.typeMessage')}
          className="flex-1 rounded-xl border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-faint outline-none focus:border-secondary"
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
