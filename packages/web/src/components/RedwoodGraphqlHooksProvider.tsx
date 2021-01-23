import type { DocumentNode } from 'graphql'
import {
  GraphQLClient,
  ClientContext,
  ClientOptions,
  useQuery,
  useMutation,
} from 'graphql-hooks'
import memCache from 'graphql-hooks-memcache'

import type { AuthContextInterface } from '@redwoodjs/auth'

import {
  FetchConfigProvider,
  useFetchConfig,
} from 'src/components/FetchConfigProvider'
import { GraphQLHooksProvider } from 'src/components/GraphQLHooksProvider'
import { FlashProvider } from 'src/flash'
import {
  BaseQueryOptions,
  GqlError,
  MutationHookOptions,
  MutationOperationResultTuple,
} from 'src/graphql'

const ApolloProviderWithFetchConfig: React.FunctionComponent<{
  config?: Omit<ClientOptions, 'cache'>
}> = ({ config = {}, children }) => {
  const { uri: url, headers } = useFetchConfig()

  const client = new GraphQLClient({
    cache: memCache(),
    url,
    headers,
    ...config,
  })

  return (
    <ClientContext.Provider value={client}>{children}</ClientContext.Provider>
  )
}

function getGqlString(doc: DocumentNode) {
  return doc.loc?.source.body ?? ''
}

const useQueryAdapter = <TData, TVariables>(
  query: DocumentNode,
  options?: BaseQueryOptions<TVariables>
) => {
  return useQuery<TData, TVariables, GqlError>(getGqlString(query), options)
}

const useMutationAdapter = <TData, TVariables>(
  mutation: DocumentNode,
  options?: MutationHookOptions<TData, TVariables>
) => {
  return useMutation<TData, TVariables, GqlError>(
    getGqlString(mutation),
    options
  ).slice(0, 2) as MutationOperationResultTuple<TData, TVariables>
}

export const RedwoodGraphqlHooksProvider: React.FC<{
  graphQLClientConfig?: Omit<ClientOptions, 'cache'>
  useAuth: () => AuthContextInterface
}> = ({ graphQLClientConfig, useAuth, children }) => {
  return (
    <FetchConfigProvider useAuth={useAuth}>
      <ApolloProviderWithFetchConfig config={graphQLClientConfig}>
        <GraphQLHooksProvider
          useQuery={useQueryAdapter}
          useMutation={useMutationAdapter}
        >
          <FlashProvider>{children}</FlashProvider>
        </GraphQLHooksProvider>
      </ApolloProviderWithFetchConfig>
    </FetchConfigProvider>
  )
}
