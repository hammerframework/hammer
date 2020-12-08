import { useState } from 'react'

import { TypedDocumentNode } from '@graphql-typed-document-node/core'
import { DocumentNode, GraphQLError, print } from 'graphql'

import { useFetchConfig } from 'src/components/FetchConfigProvider'

import {
  BaseQueryOptions,
  GqlError,
  OperationVariables,
  OperationResult,
} from '.'

export function useQuery<TData = any, TVariables = OperationVariables>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  options?: BaseQueryOptions<TVariables>
): OperationResult<TData> {
  const { uri, headers } = useFetchConfig()
  const [data, setData] = useState<TData | undefined>(undefined)
  const [error, setError] = useState<GqlError>()
  const [loading, setLoading] = useState(true)

  React.useEffect(() => {
    const fetchData = async () => {
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
      }

      try {
        const res = await fetch(uri, {
          method: 'post',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: print(query),
            variables: options?.variables,
          }),
        })

        const json = await res.json()

        if (json.errors && json.errors.length > 0) {
          throw json.errors
        } else {
          setData(json.data)
          setLoading(false)
        }
      } catch (error) {
        handleError(error)
        setLoading(false)
      }
    }
    fetchData()
  }, [uri, headers, query, options?.variables])

  return { data, error, loading }
}
