/**
 * NOTE: This module should not contain any nodejs functionality,
 * because it's also used by Storybook in the browser.
 */
import React from 'react'

import type { AuthContextInterface } from '@redwoodjs/auth'
import { AuthProvider } from '@redwoodjs/auth'
import { HistoryProvider } from '@redwoodjs/history'
import { LocationProvider } from '@redwoodjs/router'
import { RedwoodApolloProvider } from '@redwoodjs/web/apollo'

import { mockedUserMeta } from './mockRequests'

// Import the user's Router from `./web/src/Router.{tsx,js}`,
// we pass the `children` from the user's Router to `./MockRouter.Router`
// so that we can populate the `routes object` in Storybook and tests.
const {
  default: UserRouterWithRoutes,
} = require('~__REDWOOD__USER_ROUTES_FOR_MOCK')

const fakeUseAuth = (): AuthContextInterface => ({
  loading: false,
  isAuthenticated: false,
  currentUser: null,
  userMetadata: null,
  logIn: async () => undefined,
  logOut: async () => undefined,
  signUp: async () => undefined,
  getToken: async () => null,
  getCurrentUser: async () => null,
  hasRole: () => false,
  reauthenticate: async () => undefined,
  client: null,
  type: 'custom',
  hasError: false,
})

export const mockAuthClient = {
  restoreAuthState: () => {},
  login: () => {},
  logout: () => {},
  signup: () => {},
  getToken: () => {
    return 'token'
  },
  getUserMetadata: () => {
    return mockedUserMeta.currentUser
  },
  client: 'Custom',
  type: 'custom',
}

export const MockProviders: React.FunctionComponent = ({ children }) => {
  return (
    <HistoryProvider>
      <AuthProvider client={mockAuthClient} type="custom">
        <RedwoodApolloProvider useAuth={fakeUseAuth}>
          <UserRouterWithRoutes />
          <LocationProvider>{children}</LocationProvider>
        </RedwoodApolloProvider>
      </AuthProvider>
    </HistoryProvider>
  )
}
