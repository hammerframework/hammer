import { createContext, useCallback, useContext, useRef } from 'react'

type Listener = () => void

export interface HistoryState {
  addListener: (listener: Listener) => void
}

export const HistoryContext = createContext<HistoryState | undefined>(undefined)

interface Props {
  children: React.ReactNode
}

export const HistoryProvider: React.FC<Props> = ({ children }) => {
  // Normally I'd use `useState` here, but there is no need to re-render
  // when a listener is added or removed, so using a ref instead
  const listeners = useRef<Listener[]>([])

  const addListener = useCallback((listener) => {
    listeners.current.push(listener)
  }, [])

  return (
    <HistoryContext.Provider value={{ addListener }}>
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
