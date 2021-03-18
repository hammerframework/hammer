import { createContext, useCallback, useContext, useState } from 'react'

type Listener = () => void

export interface HistoryState {
  addListener: (listener: Listener) => void
  push: (data: any, title: string, url: string) => void
  replace: (data: any, title: string, url: string) => void
}

export const HistoryContext = createContext<HistoryState | undefined>(undefined)

interface Props {
  children: React.ReactNode
}

export const HistoryProvider: React.FC<Props> = ({ children }) => {
  const [listeners, setListeners] = useState<Listener[]>([])

  const addListener = useCallback(
    (listener) => {
      listeners.push(listener)
      setListeners(listeners)
    },
    [listeners]
  )

  const push = useCallback(
    (data: any, title: string, url: string) => {
      global.history.pushState(data, title, url)
      listeners.forEach((listener) => listener())
    },
    [listeners]
  )

  const replace = useCallback(
    (data: any, title: string, url: string) => {
      global.history.replaceState(data, title, url)
      listeners.forEach((listener) => listener())
    },
    [listeners]
  )

  return (
    <HistoryContext.Provider value={{ addListener, push, replace }}>
      {children}
    </HistoryContext.Provider>
  )
}

export const useHistory = () => {
  const history = useContext(HistoryContext)

  if (history === undefined) {
    throw new Error('useHistory must be used within a HistoryProvider')
  }

  return history
}
