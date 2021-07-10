import React from 'react'

import { AuthContext } from './AuthProvider'
import type { AuthContextInterface } from './AuthProvider'

export const useAuth = (): AuthContextInterface => {
  return React.useContext(AuthContext) as AuthContextInterface
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface Global {
      __REDWOOD__USE_AUTH: () => AuthContextInterface
      REDWOOD_API_URL: string
      REDWOOD_API_GRAPHQL_SERVER_PATH: string
    }
  }
}

global.__REDWOOD__USE_AUTH = useAuth
