import React from 'react'

import { AuthContext } from './AuthProvider'
import type { AuthContextInterface } from './AuthProvider'

export const useAuth = () => React.useContext(AuthContext)

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface Global {
      __REDWOOD__USE_AUTH: () => AuthContextInterface
      __REDWOOD__API_PROXY_PATH: string
    }
  }
}

global.__REDWOOD__USE_AUTH = useAuth
