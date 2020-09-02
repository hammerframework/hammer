import type { default as GoTrue } from 'gotrue-js'
import type { User } from 'gotrue-js'

import type { AuthClient } from './'
export type GoTrueUser = User
export type { GoTrue }

export interface AuthClientGoTrue extends AuthClient {
  login(options: {
    email: string
    password: string
    remember?: boolean
  }): Promise<GoTrueUser>
  client: GoTrue
}

export const goTrue = (client: GoTrue): AuthClientGoTrue => {
  return {
    type: 'goTrue',
    client,
    signUp: ({ email, password }) => {
      return client.signup(email, password)
    },
    login: async ({ email, password, remember }) =>
      client.login(email, password, remember),
    logout: async () => {
      const user = await client.currentUser()
      return user?.logout()
    },
    getToken: async () => {
      const user = await client.currentUser()
      return user?.jwt() || null
    },
    getUserMetadata: async () => client.currentUser(),
  }
}
