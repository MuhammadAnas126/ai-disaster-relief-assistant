import { cn } from '../../lib/utils'

const DOT_DELAYS_MS = [0, 150, 300]

/**
 * WhatsApp-style typing indicator: three dots bouncing in sequence.
 * Shown while the assistant is generating a reply. Each dot delays
 * slightly after the previous one, producing a wave-like bounce.
 */
export function TypingIndicator({ className }: { className?: string }) {
  return (
    <div
      role="status"
      className={cn('flex w-fit items-center gap-1 rounded-xl bg-accent/15 px-3.5 py-3', className)}
    >
      {DOT_DELAYS_MS.map((delay) => (
        <span
          key={delay}
          className="h-1.5 w-1.5 animate-typing-dot rounded-full bg-text-muted"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
      <span className="sr-only">Assistant is typing…</span>
    </div>
  )
}
