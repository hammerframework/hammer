import type _React from 'react'

import type _gql from 'graphql-tag'
import type _PropTypes from 'prop-types'

declare global {
  const React: typeof _React
  const PropTypes: typeof _PropTypes
  const gql: typeof _gql

  interface Window {
    REDWOOD_API_URL: string
    REDWOOD_API_GRAPHQL_SERVER_PATH: string
  }

  // Overridable graphQL hook return types
  interface QueryOperationResult<TData = any> {
    data: TData | undefined
    loading: boolean
    // @MARK not adding error here, as it gets overriden by type overrides
    // see packages/web/src/apollo/typeOverride.ts
  }

  // not defining it here, because it gets overriden by Apollo provider anyway
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface MutationOperationResult<TData = any, TVariables = any> {}
}
