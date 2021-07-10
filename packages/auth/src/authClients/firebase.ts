import type FirebaseNamespace from 'firebase/app'

import { AuthClient } from './'

export type Firebase = typeof FirebaseNamespace

// @TODO: Firebase doesn't export a list of providerIds they use
// But I found them here: https://github.com/firebase/firebase-js-sdk/blob/a5768b0aa7d7ce732279931aa436e988c9f36487/packages/rules-unit-testing/src/api/index.ts
export type oAuthProvider =
  | 'google.com'
  | 'facebook.com'
  | 'github.com'
  | 'twitter.com'
  | 'microsoft.com'
  | 'apple.com'

export type Prompt = 'none' | 'consent' | 'select_account'

// valid parameters as of 2021-06-12 at https://firebase.google.com/docs/reference/js/firebase.auth.GoogleAuthProvider#setcustomparameters
export type CustomParameters = {
  hd?: string
  include_granted_scopes?: boolean
  login_hint?: string
  prompt?: Prompt
}

export type Options = {
  providerId?: oAuthProvider
  email?: string
  password?: string
  scopes?: string[] // scopes available at https://developers.google.com/identity/protocols/oauth2/scopes
  customParameters?: CustomParameters
}

const hasPasswordCreds = (options: Options): boolean => {
  return options.email !== undefined && options.password !== undefined
}

export const firebase = (client: Firebase): AuthClient => {
  // Use a function to allow us to extend for non-oauth providers in the future
  const getProvider = (providerId: oAuthProvider) => {
    return new client.auth.OAuthProvider(providerId)
  }
  const applyProviderOptions = (provider: any, options: Options) => {
    if (options.customParameters) {
      provider.setCustomParameters(options.customParameters)
    }
    if (options.scopes) {
      options.scopes.forEach((scope) => provider.addScope(scope))
    }
    return provider
  }
  // Firebase auth functions return a goog.Promise which as of 2021-05-12 does
  // not appear to work with try {await} catch blocks as exceptions are not caught.
  // This client returns a new standard Promise so that the exceptions can be
  // caught and no changes are required in common auth code located in AuthProvider.tsx
  const repackagePromise = (
    fireBasePromise: Promise<any | string>
  ): Promise<any | string> => {
    return new Promise((resolve, reject) => {
      fireBasePromise
        .then((result) => resolve(result))
        .catch((error) => reject(error))
    })
  }

  return {
    type: 'firebase',
    client,
    restoreAuthState: () => repackagePromise(client.auth().getRedirectResult()),
    login: (
      options: oAuthProvider | Options = { providerId: 'google.com' }
    ) => {
      // If argument provided is a string, it should be the oAuth Provider
      // Cast the provider string into the options object
      if (typeof options === 'string') {
        options = { providerId: options }
      }
      if (hasPasswordCreds(options)) {
        return repackagePromise(
          client
            .auth()
            .signInWithEmailAndPassword(
              options.email as string,
              options.password as string
            )
        )
      }

      const provider = getProvider(options.providerId || 'google.com')
      const providerWithOptions = applyProviderOptions(provider, options)
      return repackagePromise(
        client.auth().signInWithPopup(providerWithOptions)
      )
    },
    logout: () => repackagePromise(client.auth().signOut()),
    signup: (
      options: oAuthProvider | Options = { providerId: 'google.com' }
    ) => {
      if (typeof options === 'string') {
        options = { providerId: options }
      }
      if (hasPasswordCreds(options)) {
        return repackagePromise(
          client
            .auth()
            .createUserWithEmailAndPassword(
              options.email as string,
              options.password as string
            )
        )
      }

      const provider = getProvider(options.providerId || 'google.com')
      const providerWithOptions = applyProviderOptions(provider, options)
      return repackagePromise(
        client.auth().signInWithPopup(providerWithOptions)
      )
    },
    getToken: () => {
      const currentUser = client.auth().currentUser
      if (currentUser) {
        return repackagePromise(currentUser.getIdToken())
      }
      return new Promise(() => {
        return null
      })
    },
    getUserMetadata: async () => client.auth().currentUser,
  }
}
