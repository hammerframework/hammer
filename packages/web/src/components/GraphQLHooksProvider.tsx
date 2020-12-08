import type { DocumentNode } from 'graphql'

import {
  BaseQueryOptions,
  FetchResult,
  OperationResult,
  OperationVariables,
} from 'src/graphql'
import { MutationHookOptions } from 'src/graphql/useMutation'

export interface GraphQLHookOptions {
  variables?: Record<string, any>
}

export declare type MutationOperationResultTuple<TData, TVariables> = [
  (options?: BaseQueryOptions<TVariables>) => Promise<FetchResult<TData>>,
  OperationResult<TData>
]

export interface GraphQLHooks {
  useQuery: <TData = any, TVariables = OperationVariables>(
    query: DocumentNode,
    options?: BaseQueryOptions<TVariables>
  ) => OperationResult<TData>
  useMutation: <TData = any, TVariables = OperationVariables>(
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

/**
 * GraphQLHooksProvider stores standard `useQuery` and `useMutation` hooks for Redwood
 * that can be mapped to your GraphQL library of choice's own `useQuery`
 * and `useMutation` implementation.
 *
 * @todo Let the user pass in the additional type for options.
 */
export const GraphQLHooksProvider: React.FunctionComponent<{
  useQuery: <TData = any, TVariables = OperationVariables>(
    query: DocumentNode,
    options?: BaseQueryOptions<TVariables>
  ) => OperationResult<TData>
  useMutation: <TData = any, TVariables = OperationVariables>(
    mutation: DocumentNode,
    options?: MutationHookOptions<TData, TVariables>
  ) => MutationOperationResultTuple<TData, TVariables>
}> = ({ useQuery, useMutation, children }) => {
  return (
    <GraphQLHooksContext.Provider
      value={{
        useQuery,
        useMutation,
      }}
    >
      {children}
    </GraphQLHooksContext.Provider>
  )
}

export function useQuery<TData = any, TVariables = OperationVariables>(
  query: DocumentNode,
  options?: BaseQueryOptions<TVariables>
): OperationResult<TData> {
  return React.useContext(GraphQLHooksContext).useQuery(query, options)
}

export function useMutation<TData = any, TVariables = OperationVariables>(
  mutation: DocumentNode,
  options?: MutationHookOptions<TData, TVariables>
): MutationOperationResultTuple<TData, TVariables> {
  return React.useContext(GraphQLHooksContext).useMutation(mutation, options)
}
