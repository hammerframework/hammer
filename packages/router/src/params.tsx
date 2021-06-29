import React, { useContext } from 'react'

import { createNamedContext, matchPath, parseSearch } from './internal'
import { useLocation } from './location'
import { useRouterState } from './router-context'

export interface ParamsContextProps {
  params: Record<string, string>
}

export const ParamsContext = createNamedContext<ParamsContextProps>('Params')

export const ParamsProvider: React.FC = ({ children }) => {
  const { routes, paramTypes, trailingSlashes } = useRouterState()
  const location = useLocation()

  let pathParams = {}
  const searchParams = parseSearch(location.search)

  for (const route of routes) {
    if (route.path) {
      const { match, params } = matchPath(
        route.path,
        location.pathname,
        paramTypes,
        trailingSlashes
      )

      if (match && typeof params !== 'undefined') {
        pathParams = params
      }
    }
  }

  return (
    <ParamsContext.Provider
      value={{
        params: {
          ...pathParams,
          ...searchParams,
        },
      }}
    >
      {children}
    </ParamsContext.Provider>
  )
}

export const useParams = () => {
  const paramsContext = useContext(ParamsContext)

  if (paramsContext === undefined) {
    throw new Error('useParams must be used within a ParamsProvider')
  }

  return paramsContext.params
}
