import React, { useReducer, createContext, useContext } from 'react'

import { useAuth } from '@redwoodjs/auth'

import type { ParamType } from 'src/internal'
import { isRoute, PageType } from 'src/router'
import { flattenAll, TrailingSlashesTypes } from 'src/util'

const DEFAULT_PAGE_LOADING_DELAY = 1000 // milliseconds
const DEFAULT_TRAILING_SLASHES = 'never'

export interface RouterState {
  paramTypes?: Record<string, ParamType>
  pageLoadingDelay?: number
  useAuth: typeof useAuth
  trailingSlashes: TrailingSlashesTypes
  routes: Array<{ name?: string; path?: string; page?: PageType }>
}

const RouterStateContext = createContext<RouterState | undefined>(undefined)

export interface RouterSetContextProps {
  setState: (newState: Partial<RouterState>) => void
}

const RouterSetContext =
  createContext<React.Dispatch<Partial<RouterState>> | undefined>(undefined)

export interface RouterContextProviderProps
  extends Omit<RouterState, 'useAuth' | 'routes' | 'trailingSlashes'> {
  useAuth?: typeof useAuth
  trailingSlashes?: TrailingSlashesTypes
}

function stateReducer(state: RouterState, newState: Partial<RouterState>) {
  return { ...state, ...newState }
}

export const RouterContextProvider: React.FC<RouterContextProviderProps> = ({
  useAuth: customUseAuth,
  paramTypes,
  trailingSlashes = DEFAULT_TRAILING_SLASHES,
  pageLoadingDelay = DEFAULT_PAGE_LOADING_DELAY,
  children,
}) => {
  // Create an internal representation of all the routes and paths.
  const routes = flattenAll(children)
    .filter(isRoute)
    .map((route) => {
      const { name, path, page } = route.props
      return { name, path, page }
    })

  const [state, setState] = useReducer(stateReducer, {
    useAuth: customUseAuth || useAuth,
    trailingSlashes,
    paramTypes,
    pageLoadingDelay,
    routes,
  })

  return (
    <RouterStateContext.Provider value={state}>
      <RouterSetContext.Provider value={setState}>
        {children}
      </RouterSetContext.Provider>
    </RouterStateContext.Provider>
  )
}

export const useRouterState = () => {
  const context = useContext(RouterStateContext)

  if (context === undefined) {
    throw new Error(
      'useRouterState must be used within a RouterContextProvider'
    )
  }

  return context
}

export const useRouterStateSetter = () => {
  const context = useContext(RouterSetContext)

  if (context === undefined) {
    throw new Error(
      'useRouterStateSetter must be used within a RouterContextProvider'
    )
  }

  return context
}
