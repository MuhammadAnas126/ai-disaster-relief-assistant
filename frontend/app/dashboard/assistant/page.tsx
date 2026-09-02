'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { Card, CardHeader, CardTitle } from '../../../components/ui/Card'
import { Button } from '../../../components/ui/Button'
import { Input, Label, Select, Textarea } from '../../../components/ui/Input'
import { EmptyState } from '../../../components/ui/States'
import { MarkdownText } from '../../../components/ui/Markdown'
import { TypingIndicator } from '../../../components/ui/TypingIndicator'
import { useSendAdminChatMessage } from '../../../hooks/useAssistant'
import { useLanguage } from '../../../lib/i18n'
import type { AlertLevel, AssistantContext, ChatMessage } from '../../../types'
import { cn } from '../../../lib/utils'

// One-click prompts, one per core assistant role: natural language case
// querying, broadcast drafting, executive summaries, visual triage aggregation.
const SUGGESTION_KEYS = [
  'assistant.suggestTrapped',
  'assistant.suggestBroadcast',
  'assistant.suggestSummary',
  'assistant.suggestVisual',
] as const

// Message ids/timestamps are generated at module scope (same pattern as
// lib/api.ts) so event-handler code paths stay clean under the React purity lint.
function buildUserMessage(text: string): ChatMessage {
  return { id: `u-${Date.now()}`, role: 'user', text, sentAt: new Date().toISOString() }
}

function buildAssistantMessage(text: string): ChatMessage {
  return { id: `a-${Date.now()}`, role: 'assistant', text, sentAt: new Date().toISOString() }
}

export default function AssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [lang, setLang] = useState<'EN' | 'UR'>('EN')
  const [draftLoaded, setDraftLoaded] = useState(false)
  const sendMessage = useSendAdminChatMessage()
  const { t } = useLanguage()

  const [alertLevel, setAlertLevel] = useState<AlertLevel>('warning')
  const [alertMessage, setAlertMessage] = useState('')
  const [showSent, setShowSent] = useState(false)

  useEffect(() => {
    if (!showSent) return
    const t = setTimeout(() => setShowSent(false), 2500)
    return () => clearTimeout(t)
  }, [showSent])

  function submitMessage(text: string) {
    const value = text.trim()
    if (!value || sendMessage.isPending) return

    const userMsg = buildUserMessage(value)
    setMessages((m) => [...m, userMsg])
    // The EN/UR toggle sets the preferred reply language for the assistant;
    // it defaults to the active UI language.
    const chatContext: AssistantContext = { language: lang === 'UR' ? 'ur' : 'en' }
    sendMessage.mutate(
      { message: value, history: [...messages, userMsg], context: chatContext },
      {
        onSuccess: (res) => {
          setMessages((m) => [...m, buildAssistantMessage(res.reply)])
          // A requested broadcast draft loads straight into the alert form
          // for review — it is never sent automatically.
          if (res.broadcast?.message) {
            setAlertLevel(res.broadcast.level)
            setAlertMessage(res.broadcast.message)
            setDraftLoaded(true)
          }
        },
      },
    )
  }

  function handleSend(e: FormEvent) {
    e.preventDefault()
    submitMessage(draft)
    setDraft('')
  }

  function handleBroadcast(e: FormEvent) {
    e.preventDefault()
    const message = alertMessage.trim()
    if (!message) return

    const alertData = {
      id: Date.now(),
      level: alertLevel,
      message,
      timestamp: new Date().toISOString(),
    }
    localStorage.setItem('latest_broadcast', JSON.stringify(alertData))
    setAlertMessage('')
    setDraftLoaded(false)
    setShowSent(true)
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <Card className="flex h-[480px] flex-col">
        <CardHeader>
          <CardTitle>{t('assistant.title')}</CardTitle>
          <button
            onClick={() => setLang((l) => (l === 'EN' ? 'UR' : 'EN'))}
            className="rounded-full border border-border px-2.5 py-1 text-xs font-medium text-text-muted hover:text-text"
          >
            {lang} / {lang === 'EN' ? 'UR' : 'EN'}
          </button>
        </CardHeader>

        <div className="flex-1 space-y-2 overflow-y-auto pr-1">
          {messages.length === 0 ? (
            <div className="space-y-3">
              <EmptyState message={t('assistant.noMessages')} hint={t('assistant.noMessagesHint')} />
              <div className="flex flex-wrap gap-2">
                {SUGGESTION_KEYS.map((key) => (
                  <button
                    key={key}
                    onClick={() => submitMessage(t(key))}
                    className="rounded-full border border-border bg-bg px-3 py-1.5 text-xs text-text-muted transition-colors hover:border-secondary hover:text-text"
                  >
                    {t(key)}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  'max-w-[85%] whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
                  msg.role === 'user' ? 'ml-auto border border-border bg-bg text-text' : 'bg-accent text-accent-foreground',
                )}
              >
                {msg.role === 'assistant' ? <MarkdownText text={msg.text} /> : msg.text}
              </div>
            ))
          )}
          {sendMessage.isPending && <TypingIndicator className="rounded-2xl" />}
        </div>

        <form onSubmit={handleSend} className="mt-3 flex gap-2">
          <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={t('common.typeMessage')} className="flex-1" />
          <Button type="submit" disabled={sendMessage.isPending}>
            {t('common.send')}
          </Button>
        </form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('assistant.broadcast')}</CardTitle>
        </CardHeader>
        <form onSubmit={handleBroadcast} className="space-y-4">
          <div>
            <Label htmlFor="level">{t('assistant.level')}</Label>
            <Select id="level" value={alertLevel} onChange={(e) => setAlertLevel(e.target.value as AlertLevel)}>
              <option value="info">{t('assistant.levelInfo')}</option>
              <option value="warning">{t('assistant.levelWarning')}</option>
              <option value="critical">{t('assistant.levelCritical')}</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="message">{t('assistant.message')}</Label>
            <Textarea
              id="message"
              rows={4}
              value={alertMessage}
              onChange={(e) => {
                setAlertMessage(e.target.value)
                setDraftLoaded(false)
              }}
              placeholder={t('assistant.messagePlaceholder')}
            />
          </div>
          <Button type="submit" className="w-full">
            {t('assistant.sendBroadcast')}
          </Button>
          {showSent && <p className="text-center text-xs text-success">{t('assistant.broadcastSent')}</p>}
          {draftLoaded && !showSent && (
            <p className="text-center text-xs text-secondary">{t('assistant.draftLoaded')}</p>
          )}
        </form>
      </Card>
    </div>
  )
}
