import { Session, User, Provider } from '@supabase/gotrue-js'
import type { SupabaseClient } from '@supabase/supabase-js'

import type { AuthClient } from './index'

export type Supabase = SupabaseClient
export type SupabaseUser = User

export interface AuthClientSupabase extends AuthClient {
  /**
   * Log in an existing user, or login via a third-party provider.
   *
   * @param options The user login details.
   * @param options.email The user's email address.
   * @param options.password The user's password.
   * @param options.refreshToken A valid refresh token that was returned on login.
   * @param { 'apple' | 'azure' | 'bitbucket' | 'discord' | 'facebook' | 'github' | 'gitlab' | 'google' | 'twitter' } options.provider One of the providers supported by GoTrue.
   * @param redirectTo A URL or mobile address to send the user to after they are confirmed.
   * @param scopes A space-separated list of scopes granted to the OAuth application.
   */
  login(options: {
    email?: string | undefined
    password?: string | undefined
    provider?: Provider
    refreshToken?: string
    redirectTo?: string
    scopes?: string
  }): Promise<{
    session: Session | null
    user: User | null
    provider?: Provider
    url?: string | null
    error: Error | null
  }>
  logout(): Promise<{ error: Error | null }>
  /**
   * Creates a new user.
   *
   * @param options The user login details.
   * @param options.email The user's email address.
   * @param options.password The user's password.
   * @param redirectTo A URL or mobile address to send the user to after they are confirmed.
   */
  signup(options: {
    email: string
    password: string
    redirectTo?: string
  }): Promise<{
    user: User | null
    session: Session | null
    error: Error | null
  }>
  /**
   * Restore Redwood authentication state when an OAuth or magiclink
   * callback redirects back to site with access token
   * by restoring the Supabase auth session
   *
   */
  restoreAuthState(): void
  client: Supabase
}

export const supabase = (client: Supabase): AuthClientSupabase => {
  return {
    type: 'supabase',
    client,
    login: async ({
      email,
      password,
      provider,
      refreshToken,
      redirectTo,
      scopes,
    }) => {
      // if refreshToken then currentSession and currentUser will be updated
      // to latest on _callRefreshToken using the passed refreshToken
      if (refreshToken) {
        return await client.auth.signIn({ refreshToken }, { redirectTo })
      }
      // magic link
      if (email && !password) {
        return await client.auth.signIn({ email }, { redirectTo })
      }
      // email and password
      if (email && password) {
        return await client.auth.signIn({ email, password }, { redirectTo })
      }
      // oauth, such as apple, twitter, github, gitlab, bitbucket, google, azure etc.
      if (provider) {
        return await client.auth.signIn({ provider }, { redirectTo, scopes })
      }
      throw new Error(
        `You must provide either an email, third-party provider or a refreshToken.`
      )
    },
    logout: async () => {
      return await client.auth.signOut()
    },
    signup: async ({ email, password, redirectTo }) => {
      return await client.auth.signUp({ email, password }, { redirectTo })
    },
    getToken: async () => {
      const currentSession = client.auth.session()
      return currentSession?.access_token || null
    },
    getUserMetadata: async () => {
      return await client.auth.user()
    },
    restoreAuthState: async () => {
      await client.auth.getSessionFromUrl()

      window.history.replaceState({}, document.title, window.location.pathname)

      return
    },
  }
}
