import type { HelmetData } from 'react-helmet-async'

export {}

declare global {
  namespace NodeJS {
    interface Global {
      __REDWOOD__PRERENDERING: boolean
      __REDWOOD__HELMET_CONTEXT: { helmet?: HelmetData }
    }
  }
}
