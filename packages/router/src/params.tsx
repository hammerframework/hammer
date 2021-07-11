import React, { useContext } from 'react'

import { createNamedContext, matchPath, parseSearch } from './internal'
import { useLocation } from './location'
import { useRouterState } from './router-context'

export interface ParamsContextProps {
  params: Record<string, string>
}

export const ParamsContext = createNamedContext<ParamsContextProps>('Params')

interface Props {
  path?: string
}

export const ParamsProvider: React.FC<Props> = ({ path, children }) => {
  const { paramTypes } = useRouterState()
  const location = useLocation()

  let pathParams = {}
  const searchParams = parseSearch(location.search)

  if (path) {
    const { match, params } = matchPath(path, location.pathname, paramTypes)

    if (match && typeof params !== 'undefined') {
      pathParams = params
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
