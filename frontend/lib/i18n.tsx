'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { dictionaries, type Language, type TranslationKey } from './dictionaries'

const STORAGE_KEY = 'preferred-language'

interface LanguageContextValue {
  language: Language
  setLanguage: (language: Language) => void
  /** Translate a dictionary key in the active language. */
  t: (key: TranslationKey) => string
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

/**
 * App-wide UI language provider. The choice persists in localStorage and only
 * changes the rendered text (plus the <html lang> attribute) — the layout
 * direction is intentionally left untouched.
 */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en')

  // Restore the persisted choice after mount; the server render stays 'en'
  // so hydration always matches.
  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === 'en' || stored === 'ur') {
      setLanguageState(stored)
    }
  }, [])

  // Keep the document language in sync so screen readers and font shaping
  // treat Urdu text correctly.
  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next)
    window.localStorage.setItem(STORAGE_KEY, next)
  }, [])

  const t = useCallback((key: TranslationKey) => dictionaries[language][key], [language])

  const value = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}
