'use client'

import type { ReactNode } from 'react'

// The AI models are prompted for plain text, but Qwen still emits light
// markdown in structured replies (**bold** labels, "- " bullets, "1." case
// lists). Rendering that subset keeps chat bubbles readable instead of
// showing raw asterisks and dashes.

// Qwen occasionally drops a stray ** (e.g. "**Case ID:** inc-1**"). When a
// line holds an odd number of ** markers, the last one is almost certainly
// the stray — drop it so the rest still parses as bold.
function dropStrayBold(line: string): string {
  const count = (line.match(/\*\*/g) ?? []).length
  if (count % 2 === 0) return line
  const last = line.lastIndexOf('**')
  return line.slice(0, last) + line.slice(last + 2)
}

// Inline markdown: **bold**, *italic*, `code`. Unmatched markers stay literal.
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = []
  const pattern = /(\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`\n]+`)/g
  let last = 0
  let i = 0
  for (const match of text.matchAll(pattern)) {
    const token = match[0]
    if (match.index > last) nodes.push(text.slice(last, match.index))
    if (token.startsWith('**')) {
      nodes.push(<strong key={`${keyPrefix}-${i}`}>{token.slice(2, -2)}</strong>)
    } else if (token.startsWith('`')) {
      nodes.push(
        <code key={`${keyPrefix}-${i}`} className="rounded-sm bg-black/20 px-1 py-0.5 text-[0.85em]">
          {token.slice(1, -1)}
        </code>,
      )
    } else {
      nodes.push(<em key={`${keyPrefix}-${i}`}>{token.slice(1, -1)}</em>)
    }
    last = match.index + token.length
    i += 1
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

interface ListBlock {
  type: 'ul' | 'ol'
  items: string[]
}

export function MarkdownText({ text, className }: { text: string; className?: string }) {
  const blocks: ReactNode[] = []
  let list: ListBlock | null = null

  function flushList() {
    if (!list) return
    const current = list
    const items = current.items.map((item, i) => (
      <li key={i}>{renderInline(item, `li-${blocks.length}-${i}`)}</li>
    ))
    blocks.push(
      current.type === 'ul' ? (
        <ul key={`list-${blocks.length}`} className="list-disc space-y-0.5 pl-4">
          {items}
        </ul>
      ) : (
        <ol key={`list-${blocks.length}`} className="list-decimal space-y-0.5 pl-4">
          {items}
        </ol>
      ),
    )
    list = null
  }

  for (const raw of text.split('\n')) {
    const line = dropStrayBold(raw)
    const trimmed = line.trim()
    const bullet = trimmed.match(/^[-*•]\s+(.+)$/)
    const numbered = trimmed.match(/^(\d+)[.)]\s+(.+)$/)
    if (bullet) {
      if (list?.type !== 'ul') flushList()
      if (!list) list = { type: 'ul', items: [] }
      list.items.push(bullet[1])
    } else if (numbered) {
      if (list?.type !== 'ol') flushList()
      if (!list) list = { type: 'ol', items: [] }
      list.items.push(numbered[2])
    } else if (trimmed === '') {
      flushList()
    } else {
      flushList()
      blocks.push(
        <p key={`p-${blocks.length}`} className="whitespace-pre-line">
          {renderInline(line, `p-${blocks.length}`)}
        </p>,
      )
    }
  }
  flushList()

  return <div className={className}>{blocks}</div>
}
