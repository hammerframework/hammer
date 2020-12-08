import { useState } from 'react'

import { DocumentNode, ExecutionResult, GraphQLError, print } from 'graphql'

import { useFetchConfig } from 'src/components/FetchConfigProvider'

import {
  BaseQueryOptions,
  GqlError,
  OperationResult,
  OperationVariables,
} from '.'

export interface FetchResult<
  TData = {
    [key: string]: any
  }
> extends ExecutionResult {
  data?: TData | null
}

export declare type MutationTuple<TData, TVariables> = [
  (options?: BaseQueryOptions<TVariables>) => Promise<FetchResult<TData>>,
  OperationResult<TData>
]

export interface MutationHookOptions<
  TData = any,
  TVariables = OperationVariables
> extends BaseQueryOptions<TVariables> {
  onCompleted?: (data: TData) => void
  onError?: (error: GqlError) => void
}

export function useMutation<TData = any, TVariables = OperationVariables>(
  mutation: DocumentNode,
  options?: MutationHookOptions<TData, TVariables>
): MutationTuple<TData, TVariables> {
  const { uri, headers } = useFetchConfig()
  const [data, setData] = useState<TData | undefined>(undefined)
  const [error, setError] = useState<GqlError>()
  const [loading, setLoading] = useState(false)

  const fetchData = async (functionOptions?: BaseQueryOptions<TVariables>) => {
    function handleError(error: GraphQLError[] | string | undefined) {
      let gqlError: GqlError

      if (typeof error === 'string') {
        gqlError = {
          message: error,
          graphQLErrors: [],
          name: '',
        }
      } else if (typeof error === 'undefined') {
        gqlError = {
          message: 'Unknown GQL error',
          graphQLErrors: [],
          name: '',
        }
      } else {
        gqlError = {
          message: '',
          graphQLErrors: error,
          name: '',
        }
      }

      setError(gqlError)
      options?.onError?.(gqlError)
    }

    setLoading(true)

    let jsonPromise

    try {
      const res = await fetch(uri, {
        method: 'post',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: print(mutation),
          variables: functionOptions?.variables || options?.variables,
        }),
      })

      jsonPromise = res.json()

      jsonPromise
        .then((json) => {
          if (json.errors && json.errors.length > 0) {
            throw json.errors
          } else {
            setData(json.data)
            setLoading(false)
            options?.onCompleted?.(json.data)
          }
        })
        .catch((error) => {
          handleError(error)
          setLoading(false)
        })
    } catch (error) {
      handleError(error)
      setLoading(false)
    }

    return jsonPromise
  }

  return [fetchData, { data, error, loading }]
}
