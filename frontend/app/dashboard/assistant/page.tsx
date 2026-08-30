'use client'

import { useState, type FormEvent } from 'react'
import { Card, CardHeader, CardTitle } from '../../../components/ui/Card'
import { Button } from '../../../components/ui/Button'
import { Input, Label, Select, Textarea } from '../../../components/ui/Input'
import { EmptyState } from '../../../components/ui/States'
import { useSendChatMessage } from '../../../hooks/useAssistant'
import { useSendAlert } from '../../../hooks/useAlerts'
import type { AlertLevel, ChatMessage } from '../../../types'
import { cn } from '../../../lib/utils'

export default function AssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [lang, setLang] = useState<'EN' | 'UR'>('EN')
  const sendMessage = useSendChatMessage()

  const [alertLevel, setAlertLevel] = useState<AlertLevel>('warning')
  const [alertMessage, setAlertMessage] = useState('')
  const sendAlert = useSendAlert()

  function handleSend(e: FormEvent) {
    e.preventDefault()
    if (!draft.trim()) return
    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: 'user', text: draft, sentAt: new Date().toISOString() }
    setMessages((m) => [...m, userMsg])
    const text = draft
    setDraft('')
    sendMessage.mutate(text, {
      onSuccess: (reply) => setMessages((m) => [...m, reply]),
    })
  }

  function handleBroadcast(e: FormEvent) {
    e.preventDefault()
    if (!alertMessage.trim()) return
    sendAlert.mutate({ level: alertLevel, message: alertMessage }, { onSuccess: () => setAlertMessage('') })
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <Card className="flex h-[480px] flex-col">
        <CardHeader>
          <CardTitle>Help chat</CardTitle>
          <button
            onClick={() => setLang((l) => (l === 'EN' ? 'UR' : 'EN'))}
            className="rounded-full border border-border px-2.5 py-1 text-xs font-medium text-text-muted hover:text-text"
          >
            {lang} / {lang === 'EN' ? 'UR' : 'EN'}
          </button>
        </CardHeader>

        <div className="flex-1 space-y-2 overflow-y-auto pr-1">
          {messages.length === 0 ? (
            <EmptyState message="No messages yet" hint="Ask about supplies, routes, or shelter status." />
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm',
                  msg.role === 'user' ? 'ml-auto border border-border bg-bg text-text' : 'bg-accent text-accent-foreground',
                )}
              >
                {msg.text}
              </div>
            ))
          )}
          {sendMessage.isPending && (
            <div className="max-w-[85%] rounded-2xl bg-accent/60 px-3.5 py-2.5 text-sm text-accent-foreground">…</div>
          )}
        </div>

        <form onSubmit={handleSend} className="mt-3 flex gap-2">
          <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Type a message…" className="flex-1" />
          <Button type="submit" disabled={sendMessage.isPending}>
            Send
          </Button>
        </form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Broadcast alert</CardTitle>
        </CardHeader>
        <form onSubmit={handleBroadcast} className="space-y-4">
          <div>
            <Label htmlFor="level">Level</Label>
            <Select id="level" value={alertLevel} onChange={(e) => setAlertLevel(e.target.value as AlertLevel)}>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              rows={4}
              value={alertMessage}
              onChange={(e) => setAlertMessage(e.target.value)}
              placeholder="Write an alert…"
            />
          </div>
          <Button type="submit" className="w-full" disabled={sendAlert.isPending}>
            {sendAlert.isPending ? 'Sending…' : 'Send broadcast'}
          </Button>
          {sendAlert.isSuccess && <p className="text-center text-xs text-success">Broadcast sent.</p>}
        </form>
      </Card>
    </div>
  )
}
