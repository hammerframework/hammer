import React from 'react'

import { createAuthClient } from './authClients'
import type {
  AuthClient,
  SupportedAuthTypes,
  SupportedAuthClients,
  SupportedUserMetadata,
} from './authClients'

export interface CurrentUser {
  roles?: Array<string>
}

export interface AuthContextInterface {
  /* Determining your current authentication state */
  loading: boolean
  isAuthenticated: boolean
  /* The current user's data from the `getCurrentUser` function on the api side */
  currentUser: null | CurrentUser
  /* The user's metadata from the auth provider */
  userMetadata: null | SupportedUserMetadata
  logIn(options?: unknown): Promise<void>
  logOut(options?: unknown): Promise<void>
  signUp(options?: unknown): Promise<void>
  getToken(): Promise<null | string>
  /**
   * Fetches the "currentUser" from the api side,
   * but does not update the current user state.
   **/
  getCurrentUser(): Promise<null | CurrentUser>
  /**
   * Checks if the "currentUser" from the api side
   * is assigned a role or one of a list of roles.
   * If the user is assigned any of the provided list of roles,
   * the hasRole is considered to be true.
   **/
  hasRole(role: string | string[]): boolean
  /**
   * Redetermine authentication state and update the state.
   */
  reauthenticate(): Promise<void>
  /**
   * A reference to the client that you passed into the `AuthProvider`,
   * which is useful if we do not support some specific functionality.
   */
  client: SupportedAuthClients
  type: SupportedAuthTypes
  hasError: boolean
  error?: Error
}

// @ts-expect-error - We do not supply default values for the functions.
export const AuthContext = React.createContext<AuthContextInterface>({
  loading: true,
  isAuthenticated: false,
  userMetadata: null,
  currentUser: null,
})

type AuthProviderProps =
  | {
      client: SupportedAuthClients
      type: Omit<SupportedAuthTypes, 'dbAuth'>
      skipFetchCurrentUser?: boolean
    }
  | {
      client?: never
      type: 'dbAuth'
      skipFetchCurrentUser?: boolean
    }

type AuthProviderState = {
  loading: boolean
  isAuthenticated: boolean
  userMetadata: null | Record<string, any>
  currentUser: null | CurrentUser
  hasError: boolean
  error?: Error
}
/**
 * @example
 * ```js
 *  const client = new Auth0Client(options)
 *  // ...
 *  <AuthProvider client={client} type="auth0" skipFetchCurrentUser={true}>
 *    {children}
 *  </AuthProvider>
 * ```
 */
export class AuthProvider extends React.Component<
  AuthProviderProps,
  AuthProviderState
> {
  static defaultProps = {
    skipFetchCurrentUser: false,
  }

  state: AuthProviderState = {
    loading: true,
    isAuthenticated: false,
    userMetadata: null,
    currentUser: null,
    hasError: false,
  }

  rwClient: AuthClient

  constructor(props: AuthProviderProps) {
    super(props)
    this.rwClient = createAuthClient(
      props.client || (() => null),
      props.type as SupportedAuthTypes
    )
  }

  async componentDidMount() {
    await this.reauthenticate()
    return this.rwClient.restoreAuthState?.()
  }

  getCurrentUser = async (): Promise<Record<string, unknown>> => {
    // Always get a fresh token, rather than use the one in state
    const token = await this.getToken()
    const response = await global.fetch(
      `${global.__REDWOOD__API_PROXY_PATH}/graphql`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'auth-provider': this.rwClient.type,
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          query:
            'query __REDWOOD__AUTH_GET_CURRENT_USER { redwood { currentUser } }',
        }),
      }
    )

    if (response.ok) {
      const { data } = await response.json()
      return data?.redwood?.currentUser
    } else {
      throw new Error(
        `Could not fetch current user: ${response.statusText} (${response.status})`
      )
    }
  }

  /**
   * @example
   * ```js
   *  hasRole("editor")
   *  hasRole(["editor"])
   *  hasRole(["editor", "author"])
   * ```
   *
   * Checks if the "currentUser" from the api side
   * is assigned a role or one of a list of roles.
   * If the user is assigned any of the provided list of roles,
   * the hasRole is considered to be true.
   */
  hasRole = (role: string | string[]): boolean => {
    if (
      typeof role !== 'undefined' &&
      this.state.currentUser &&
      this.state.currentUser.roles
    ) {
      if (typeof role === 'string') {
        return this.state.currentUser.roles?.includes(role) || false
      }

      if (Array.isArray(role)) {
        return this.state.currentUser.roles.some((r) => role.includes(r))
      }
    }

    return false
  }

  getToken = async () => {
    return this.rwClient.getToken()
  }

  reauthenticate = async () => {
    const notAuthenticatedState: AuthProviderState = {
      isAuthenticated: false,
      currentUser: null,
      userMetadata: null,
      loading: false,
      hasError: false,
    }

    try {
      const userMetadata = await this.rwClient.getUserMetadata()
      if (!userMetadata) {
        this.setState(notAuthenticatedState)
      } else {
        await this.getToken()

        const currentUser = this.props.skipFetchCurrentUser
          ? null
          : await this.getCurrentUser()

        this.setState({
          ...this.state,
          userMetadata,
          currentUser,
          isAuthenticated: true,
          loading: false,
        })
      }
    } catch (e) {
      this.setState({
        ...notAuthenticatedState,
        hasError: true,
        error: e,
      })
    }
  }

  logIn = async (options?: any) => {
    const loginOutput = await this.rwClient.login(options)
    await this.reauthenticate()

    return loginOutput
  }

  logOut = async (options?: any) => {
    await this.rwClient.logout(options)
    this.setState({
      userMetadata: null,
      currentUser: null,
      isAuthenticated: false,
      hasError: false,
      error: undefined,
    })
  }

  signUp = async (options?: any) => {
    const signupOutput = await this.rwClient.signup(options)
    await this.reauthenticate()
    return signupOutput
  }

  render() {
    const { client, type, children } = this.props

    return (
      <AuthContext.Provider
        value={{
          ...this.state,
          logIn: this.logIn,
          logOut: this.logOut,
          signUp: this.signUp,
          getToken: this.getToken,
          getCurrentUser: this.getCurrentUser,
          hasRole: this.hasRole,
          reauthenticate: this.reauthenticate,
          client,
          type: type as SupportedAuthTypes,
        }}
      >
        {children}
      </AuthContext.Provider>
    )
  }
}
