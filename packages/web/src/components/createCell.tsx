import type { DocumentNode } from 'graphql'
import type { A } from 'ts-toolbelt'

import { useQuery, useMutation } from './GraphQLHooksProvider'

interface QueryProps {
  query: DocumentNode
  children: (result: QueryOperationResult) => React.ReactElement
}

interface MutationProps {
  mutation: DocumentNode
  children: (result: MutationOperationResult) => React.ReactElement
}

export type QueryTag = React.JSXElement
const Query = ({ children, query, ...rest }: QueryProps) => {
  const result = useQuery(query, rest)
  return result ? children(result) : null
}

export type MutationTag = React.JSXElement
const Mutation = ({ children, mutation, ...rest }: MutationProps) => {
  const result = useMutation(mutation, rest)
  return result ? children(result) : null
}

export type QueryOrMutationTag = QueryTag | MutationTag

const QueryOrMutation: QueryOrMutationTag = Query || Mutation

export type DataObject = { [key: string]: unknown }

export type CellFailureProps =
  | (Omit<QueryOperationResult, 'data' | 'loading'> & { updating: boolean })
  | { error: Error } // for tests and storybook

export type CellLoadingProps = Omit<
  QueryOperationResult,
  'error' | 'loading' | 'data'
>
// @MARK not sure about this partial, but we need to do this for tests and storybook
// `updating` is just `loading` renamed; since Cells default to stale-while-refetch,
// this prop lets users render something like a spinner to show that a request is in-flight
export type CellSuccessProps<TData = any> = Partial<
  Omit<QueryOperationResult<TData>, 'error' | 'data'> & { updating: boolean }
> &
  A.Compute<TData> // pre-computing makes the types more readable on hover

export interface CreateCellProps<CellProps> {
  beforeQuery?: <TProps>(props: TProps) => { variables: TProps }
  QUERY: DocumentNode | ((variables: Record<string, unknown>) => DocumentNode)
  MUTATION: DocumentNode | ((variables: Record<string, unknown>) => DocumentNode)
  afterQuery?: (data: DataObject) => DataObject
  Loading?: React.FC<CellLoadingProps & Partial<CellProps>>
  Failure?: React.FC<CellFailureProps & Partial<CellProps>>
  Empty?: React.FC<CellLoadingProps & Partial<CellProps>>
  Success: React.FC<CellSuccessProps & Partial<CellProps>>
}

/**
 * Is a higher-order-component that executes a GraphQL query and automatically
 * manages the lifecycle of that query. If you export named parameters that match
 * the required params of `createCell` it will be automatically wrapped in this
 * HOC via a babel-plugin.
 *
 * @param {string} QUERY - The graphQL syntax tree to execute
 * @param {string} MUTATION - The graphQL syntax tree to execute
 * @param {function=} beforeQuery - Prepare the variables and options for the query
 * @param {function=} afterQuery - Sanitize the data return from graphQL
 * @param {Component=} Loading - Loading, render this component
 * @param {Component=} Empty - Loading, render this component
 * @param {Component=} Failure - Something went wrong, render this component
 * @param {Component} Success - Data has loaded, render this component
 *
 * @example
 * ```js
 * // IMPLEMENTATION:
 * // `src/ExampleComponent/index.js`. This file is automatically dealt with
 * in webpack.
 *
 * import { createCell } from '@redwoodjs/web'
 * import * as cell from './ExampleComponent'
 *
 * export default createCell(cell)
 * ```
 *
 * // USAGE:
 * // Now you have a cell component that will handle the lifecycle methods of
 * // a query
 * import ExampleComponent from 'src/ExampleComponent'
 *
 * const ThingThatUsesExampleComponent = () => {
 *  return <div><ExampleComponent /></div>
 * }
 */

const isDataNull = (data: DataObject) => {
  return dataField(data) === null
}

const isDataEmptyArray = (data: DataObject) => {
  const field = dataField(data)
  return Array.isArray(field) && field.length === 0
}

const dataField = (data: DataObject) => {
  return data[Object.keys(data)[0]]
}

const isEmpty = (data: DataObject) => {
  return isDataNull(data) || isDataEmptyArray(data)
}

export function createCell<CellProps = any>({
  beforeQuery = (props) => ({
    variables: props,
    fetchPolicy: 'cache-and-network',
    notifyOnNetworkStatusChange: true,
  }),
  QUERY,
  MUTATION,
  afterQuery = (data) => ({ ...data }),
  Loading = () => <>Loading...</>,
  Failure,
  Empty,
  Success,
}: CreateCellProps<CellProps>): React.FC<CellProps> {
  if (global.__REDWOOD__PRERENDERING) {
    // If its prerendering, render the Cell's Loading component
    // and exit early. The apolloclient loading props aren't available here, so 'any'
    return (props) => <Loading {...(props as any)} />
  }

  return (props) => {
    const {
      children, // eslint-disable-line @typescript-eslint/no-unused-vars
      ...variables
    } = props

    const isQuery = !!QUERY
    const queryOrMutation = isQuery ? QUERY : MUTATION

    return (
      <QueryOrMutation
        query={
          typeof queryOrMutation === 'function' ? queryOrMutation(beforeQuery(variables)) : queryOrMutation
        }
        {...beforeQuery(variables)}
      >
        {({ error, loading, data, ...queryRest }) => {
          if (error) {
            if (Failure) {
              return (
                <Failure
                  error={error}
                  {...{ updating: loading, ...queryRest, ...props }}
                />
              )
            } else {
              throw error
            }
          } else if (data) {
            if (typeof Empty !== 'undefined' && isEmpty(data)) {
              return (
                <Empty {...{ updating: loading, ...queryRest, ...props }} />
              )
            } else {
              return (
                <Success
                  {...afterQuery(data)}
                  {...{ updating: loading, ...queryRest, ...props }}
                />
              )
            }
          } else if (loading) {
            return <Loading {...queryRest} {...props} />
          } else {
            throw new Error(
              'Cannot render cell: GraphQL success but `data` is null'
            )
          }
        }}
      </QueryOrMutation>
    )
  }
}
