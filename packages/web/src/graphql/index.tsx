import type { GraphQLError, ExecutionResult } from 'graphql'

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

export interface HttpError {
  status: number
  statusText: string
  body: string
}

export interface APIError {
  fetchError?: Error
  httpError?: HttpError
  graphQLErrors?: GqlError[]
}

export interface OperationResult<TData> {
  data?: TData
  loading: boolean
  error?: APIError
}

export interface FetchResult<TData> extends ExecutionResult {
  data?: TData | null
}

export type MutationOperationResultTuple<TData, TVariables> = [
  (options?: TVariables) => Promise<FetchResult<TData>>,
  OperationResult<TData>
]

export interface BaseQueryOptions<TVariables> {
  variables?: TVariables
}

export interface MutationHookOptions<TData, TVariables>
  extends BaseQueryOptions<TVariables> {
  onCompleted?: (data: TData) => void
  onError?: (error: GqlError) => void
}
