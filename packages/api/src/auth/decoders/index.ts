import type { APIGatewayProxyEvent, Context as LambdaContext } from 'aws-lambda'

import type { SupportedAuthTypes } from '@redwoodjs/auth'

import type { GlobalContext } from 'src/globalContext'

import { auth0 } from './auth0'
import { azureActiveDirectory } from './azureActiveDirectory'
import { dbAuth } from './dbAuth'
import { ethereum } from './ethereum'
import { netlify } from './netlify'
import { nhost } from './nhost'
import { supabase } from './supabase'

const noop = (token: string) => token

interface Req {
  event: APIGatewayProxyEvent
  context: GlobalContext & LambdaContext
}

type Decoded = null | string | Record<string, unknown>

const typesToDecoders: Record<
  SupportedAuthTypes,
  | ((token: string) => Decoded | Promise<Decoded>)
  | ((token: string, req: Req) => Decoded | Promise<Decoded>)
> = {
  auth0: auth0,
  azureActiveDirectory: azureActiveDirectory,
  netlify: netlify,
  nhost: nhost,
  goTrue: netlify,
  magicLink: noop,
  firebase: noop,
  supabase: supabase,
  ethereum: ethereum,
  dbAuth: dbAuth,
  custom: noop,
}

export const decodeToken = async (
  type: SupportedAuthTypes,
  token: string,
  req: Req
): Promise<Decoded> => {
  if (!typesToDecoders[type]) {
    // Make this a warning, instead of a hard error
    // Allow users to have multiple custom types if they choose to
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        `The auth type "${type}" is not officially supported, we currently support: ${Object.keys(
          typesToDecoders
        ).join(', ')}`
      )

      console.warn(
        'Please ensure you have handlers for your custom auth in getCurrentUser in src/lib/auth.{js,ts}'
      )
    }
  }
  const decoder = typesToDecoders[type] || noop
  return decoder(token, req)
}
