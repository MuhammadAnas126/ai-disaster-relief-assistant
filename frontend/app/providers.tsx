'use client'

import { useState, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '../lib/authContext'
import { LanguageProvider } from '../lib/i18n'

// NOTE: The floating ChatWidget is intentionally NOT mounted globally here.
// It is scoped to the public "Register Your Case" module (app/register/case)
// so victims get survival guidance exactly where they need it.

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            staleTime: 15_000,
          },
        },
      }),
  )

  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AuthProvider>{children}</AuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  )
}
