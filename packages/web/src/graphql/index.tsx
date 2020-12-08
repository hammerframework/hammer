import { GraphQLError } from 'graphql'

export declare type OperationVariables = Record<string, unknown>

export declare class GqlError extends Error {
  message: string
  graphQLErrors: ReadonlyArray<GraphQLError>
  extraInfo?: any

  constructor({
    graphQLErrors,
    errorMessage,
    extraInfo,
  }: {
    graphQLErrors?: ReadonlyArray<GraphQLError>
    errorMessage?: string
    extraInfo?: any
  })
}

export interface OperationResult<TData = any> {
  data?: TData
  loading: boolean
  error?: GqlError
}

export interface BaseQueryOptions<TVariables = OperationVariables> {
  variables?: TVariables
}

export * from './useQuery'
export { FetchResult } from './useMutation'
