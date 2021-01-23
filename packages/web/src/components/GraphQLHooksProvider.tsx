import type { DocumentNode } from 'graphql'

import {
  BaseQueryOptions,
  MutationHookOptions,
  MutationOperationResultTuple,
  OperationResult,
} from 'src/graphql'

export interface GraphQLHooks {
  useQuery: <TData, TVariables>(
    query: DocumentNode,
    options?: BaseQueryOptions<TVariables>
  ) => OperationResult<TData>
  useMutation: <TData, TVariables>(
    mutation: DocumentNode,
    options?: MutationHookOptions<TData, TVariables>
  ) => MutationOperationResultTuple<TData, TVariables>
}
export const GraphQLHooksContext = React.createContext<GraphQLHooks>({
  useQuery: () => {
    throw new Error(
      'You must register a useQuery hook via the `GraphQLHooksProvider`'
    )
  },
  useMutation: () => {
    throw new Error(
      'You must register a useMutation hook via the `GraphQLHooksProvider`'
    )
  },
})

interface ProviderProps {
  useQuery: <TData, TVariables>(
    query: DocumentNode,
    options?: BaseQueryOptions<TVariables>
  ) => OperationResult<TData>
  useMutation: <TData, TVariables>(
    mutation: DocumentNode,
    options?: MutationHookOptions<TData, TVariables>
  ) => MutationOperationResultTuple<TData, TVariables>
}

/**
 * GraphQLHooksProvider stores standard `useQuery` and `useMutation` hooks for
 * Redwood that can be mapped to your GraphQL library of choice's own `useQuery`
 * and `useMutation` implementation.
 *
 * @todo Let the user pass in the additional type for options.
 */
export const GraphQLHooksProvider: React.FC<ProviderProps> = ({
  useQuery,
  useMutation,
  children,
}) => {
  return (
    <GraphQLHooksContext.Provider value={{ useQuery, useMutation }}>
      {children}
    </GraphQLHooksContext.Provider>
  )
}

export function useQuery<TData, TVariables>(
  query: DocumentNode,
  options?: BaseQueryOptions<TVariables>
): OperationResult<TData> {
  return React.useContext(GraphQLHooksContext).useQuery<TData, TVariables>(
    query,
    options
  )
}

export function useMutation<TData, TVariables>(
  mutation: DocumentNode,
  options?: MutationHookOptions<TData, TVariables>
): MutationOperationResultTuple<TData, TVariables> {
  return React.useContext(GraphQLHooksContext).useMutation<TData, TVariables>(
    mutation,
    options
  )
}
