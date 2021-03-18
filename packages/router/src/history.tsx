const createHistory = () => {
  type Listener = (ev?: PopStateEvent) => any

  const listeners: Record<string, Listener> = {}

  return {
    listen: (listener: Listener) => {
      const listenerId = 'RW_HISTORY_LISTENER_ID_' + Date.now()
      listeners[listenerId] = listener
      global.addEventListener('popstate', listener)
      return listenerId
    },
    navigate: (to: string) => {
      const { pathname, search, hash } = new URL(global?.location?.origin + to)

      if (
        global?.location?.pathname !== pathname ||
        global?.location?.search !== search ||
        global?.location?.hash !== hash
      ) {
        global.history.pushState({}, '', to)

        for (const listener of Object.values(listeners)) {
          listener()
        }
      }
    },
    jump: (to: string, title = '') => {
      global.history.replaceState({}, title, to)

      for (const listener of Object.values(listeners)) {
        listener()
      }
    },
    remove: (listenerId: string) => {
      if (listeners[listenerId]) {
        const listener = listeners[listenerId]
        global.removeEventListener('popstate', listener)
        delete listeners[listenerId]
      } else {
        console.warn(
          'History Listener with ID: ' + listenerId + ' does not exist.'
        )
      }
    },
  }
}

const gHistory = createHistory()

const navigate = gHistory.navigate

export { gHistory, navigate }
