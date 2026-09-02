/**
 * Helpers for the browser speechSynthesis API (text-to-speech) used by the
 * Muhafiz chat read-aloud feature. SpeechSynthesisUtterance /
 * SpeechSynthesisVoice are already covered by the standard DOM lib types.
 */

/** Urdu Unicode block (Arabic script) — used to detect a text's language. */
const URDU_CHAR_RE = /[\u0600-\u06FF]/

/**
 * Pick the speech language for a text: Urdu when it contains Arabic-script
 * characters, English otherwise. Drives the synthesis voice matching.
 */
export function detectSpeechLang(text: string): 'ur-PK' | 'en-US' {
  return URDU_CHAR_RE.test(text) ? 'ur-PK' : 'en-US'
}

/** Find the best available synthesis voice for a BCP-47 language tag.
 *  Urdu voices are rarely installed — when none exists, an Arabic voice
 *  pronounces the shared Arabic script far better than a Latin-script (e.g.
 *  English) voice reading the same text. */
export function pickSpeechVoice(
  voices: SpeechSynthesisVoice[],
  lang: 'ur-PK' | 'en-US',
): SpeechSynthesisVoice | null {
  const base = lang.slice(0, 2).toLowerCase()
  const exact = voices.find((v) => v.lang.replace('_', '-').toLowerCase() === lang.toLowerCase())
  if (exact) return exact
  const sameLang = voices.find((v) => v.lang.toLowerCase().startsWith(base))
  if (sameLang) return sameLang
  if (base === 'ur') {
    return voices.find((v) => v.lang.toLowerCase().startsWith('ar')) ?? null
  }
  return null
}
