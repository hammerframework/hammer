import type { ApolloClientOptions } from '@apollo/client'
import * as apolloClient from '@apollo/client'
import { setContext } from '@apollo/client/link/context'
// Note: Importing directly from `apollo/client` does not work properly in Storybook.
const {
  ApolloProvider,
  ApolloClient,
  ApolloLink,
  createHttpLink,
  InMemoryCache,
  useQuery,
  useMutation,
} = apolloClient

import type { AuthContextInterface } from '@redwoodjs/auth'
import { useAuth as useRWAuth } from '@redwoodjs/auth'
import './typeOverride'

import {
  FetchConfigProvider,
  useFetchConfig,
} from 'src/components/FetchConfigProvider'
import { GraphQLHooksProvider } from 'src/components/GraphQLHooksProvider'

export type GraphQLClientConfigProp = Omit<
  ApolloClientOptions<unknown>,
  'cache'
>

export type UseAuthProp = () => AuthContextInterface

const ApolloProviderWithFetchConfig: React.FunctionComponent<{
  config?: GraphQLClientConfigProp
  useAuth: UseAuthProp
}> = ({ config = {}, children, useAuth }) => {
  const { uri, headers } = useFetchConfig()
  const { getToken, type: authProviderType, isAuthenticated } = useAuth()

  const withToken = setContext(async () => {
    if (isAuthenticated && getToken) {
      const token = await getToken()

      return { token }
    }

    return { token: null }
  })

  const authMiddleware = new ApolloLink((operation, forward) => {
    const { token } = operation.getContext()

    // Only add auth headers when token is present
    // Token is null, when !isAuthenticated
    const authHeaders = token
      ? {
          'auth-provider': authProviderType,
          authorization: `Bearer ${token}`,
        }
      : {}

    operation.setContext(() => ({
      headers: {
        ...headers,
        // Duped auth headers, because we may remove FetchContext at a later date
        ...authHeaders,
      },
    }))
    return forward(operation)
  })

  const httpLink = createHttpLink({ uri })

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    ...config,
    link: ApolloLink.from([withToken, authMiddleware.concat(httpLink)]),
  })

  return <ApolloProvider client={client}>{children}</ApolloProvider>
}

export const RedwoodApolloProvider: React.FunctionComponent<{
  graphQLClientConfig?: GraphQLClientConfigProp
  useAuth?: UseAuthProp
}> = ({ graphQLClientConfig, useAuth = useRWAuth, children }) => {
  return (
    <FetchConfigProvider useAuth={useAuth}>
      <ApolloProviderWithFetchConfig
        config={graphQLClientConfig}
        useAuth={useAuth}
      >
        <GraphQLHooksProvider useQuery={useQuery} useMutation={useMutation}>
          {children}
        </GraphQLHooksProvider>
      </ApolloProviderWithFetchConfig>
    </FetchConfigProvider>
  )
}
