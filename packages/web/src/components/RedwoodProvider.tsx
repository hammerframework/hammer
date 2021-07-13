import { HelmetProvider } from 'react-helmet-async'

import { HistoryProvider } from '@redwoodjs/history'

interface RedwoodProviderProps {
  children: React.ReactNode
}

export const RedwoodProvider = ({ children }: RedwoodProviderProps) => {
  return (
    <HistoryProvider>
      <HelmetProvider context={global.__REDWOOD__HELMET_CONTEXT}>
        {children}
      </HelmetProvider>
    </HistoryProvider>
  )
}

declare global {}
