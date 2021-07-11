import type { HelmetData } from 'react-helmet-async'

export {}

declare global {
  namespace NodeJS {
    interface Global {
      /**
       * This global is set to true by the prerendering CLI command.
       */
      __REDWOOD__PRERENDERING: boolean
      __REDWOOD__HELMET_CONTEXT: { helmet?: HelmetData }
    }
  }
}
