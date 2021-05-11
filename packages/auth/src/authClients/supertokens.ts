import AuthRecipe from 'supertokens-auth-react/lib/build/recipe/authRecipeModule'
import Sessions from 'supertokens-auth-react/recipe/session'

import { AuthClient } from './index'

export interface SuperTokensUser {
  userId: string
  jwtPayload: any
}

export const supertokens = <T, S, R, N>(client: {
  authRecipe: AuthRecipe<T, S, R, N>
  sessions: typeof Sessions
}): AuthClient => {
  return {
    type: 'supertokens',
    client: undefined,

    login: async () => client.authRecipe.redirectToAuth('signin'),

    logout: () => client.authRecipe.signOut(),

    signup: async () => client.authRecipe.redirectToAuth('signup'),

    getToken: async () => null,

    getUserMetadata: async (): Promise<SuperTokensUser | null> => {
      if (await client.sessions.doesSessionExist()) {
        return {
          userId: await client.sessions.getUserId(),
          jwtPayload: await client.sessions.getJWTPayloadSecurely(),
        }
      } else {
        return null
      }
    },
  }
}
