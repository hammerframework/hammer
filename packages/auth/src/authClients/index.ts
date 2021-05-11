import type { Auth0, Auth0User } from './auth0'
import { auth0 } from './auth0'
import type {
  AzureActiveDirectory,
  AzureActiveDirectoryUser,
} from './azureActiveDirectory'
import { azureActiveDirectory } from './azureActiveDirectory'
import type { Custom } from './custom'
import { custom } from './custom'
import type { Ethereum, EthereumUser } from './ethereum'
import { ethereum } from './ethereum'
import type { Firebase } from './firebase'
import { firebase } from './firebase'
import type { GoTrue, GoTrueUser } from './goTrue'
import { goTrue } from './goTrue'
import type { MagicLink, MagicUser } from './magicLink'
import { magicLink } from './magicLink'
import type { NetlifyIdentity } from './netlify'
import { netlify } from './netlify'
import type { Nhost, NhostUser } from './nhost'
import { nhost } from './nhost'
import type { Supabase, SupabaseUser } from './supabase'
import { supabase } from './supabase'
import type { SuperTokensUser } from './supertokens'
import { supertokens } from './supertokens'

const typesToClients = {
  netlify,
  auth0,
  azureActiveDirectory,
  goTrue,
  magicLink,
  firebase,
  supabase,
  ethereum,
  nhost,
  supertokens,
  /** Don't we support your auth client? No problem, define your own the `custom` type! */
  custom,
}

export type SupportedAuthClients =
  | Auth0
  | AzureActiveDirectory
  | GoTrue
  | NetlifyIdentity
  | MagicLink
  | Firebase
  | Supabase
  | Ethereum
  | Nhost
  | Custom

export type SupportedAuthTypes = keyof typeof typesToClients

export type { Auth0User }
export type { AzureActiveDirectoryUser }
export type { GoTrueUser }
export type { MagicUser }
export type { SupabaseUser }
export type { EthereumUser }
export type { NhostUser }
export type { SuperTokensUser }
export type SupportedUserMetadata =
  | Auth0User
  | AzureActiveDirectoryUser
  | GoTrueUser
  | MagicUser
  | SupabaseUser
  | EthereumUser
  | NhostUser
  | SuperTokensUser

export interface AuthClient {
  restoreAuthState?(): void | Promise<any>
  login(options?: any): Promise<any>
  logout(options?: any): void | Promise<any>
  signup(options?: any): void | Promise<any>
  getToken(): Promise<null | string>
  /** The user's data from the AuthProvider */
  getUserMetadata(): Promise<null | SupportedUserMetadata>
  client: SupportedAuthClients
  type: SupportedAuthTypes
}

export const createAuthClient = (
  client: SupportedAuthClients,
  type: SupportedAuthTypes
): AuthClient => {
  if (!typesToClients[type]) {
    throw new Error(
      `Your client ${type} is not supported, we only support ${Object.keys(
        typesToClients
      ).join(', ')}`
    )
  }
  return typesToClients[type](client)
}
