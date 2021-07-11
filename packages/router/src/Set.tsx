import React, { ReactElement, ReactNode, useCallback } from 'react'

import { Redirect } from './links'
import { routes as namedRoutes } from './router'
import { useRouterState } from './router-context'

type WrapperType<WTProps> = (
  props: WTProps & { children: ReactNode }
) => ReactElement | null

type ReduceType = ReactElement | undefined

type SetProps<P> = P & {
  // P is the interface for the props that are forwarded to the wrapper
  // components. TypeScript will most likely infer this for you, but if you
  // need to you can specify it yourself in your JSX like so:
  //   <Set<{theme: string}> wrap={ThemeableLayout} theme="dark">
  wrap?: WrapperType<P> | WrapperType<P>[]
  /**
   * `Routes` nested in a `<Set>` with `private` specified require
   * authentication. When a user is not authenticated and attempts to visit
   * the wrapped route they will be redirected to `unauthenticated` route.
   */
  private?: boolean
  /** The page name where a user will be redirected when not authenticated */
  unauthenticated?: string
  role?: string | string[]
  /** Prerender all pages in the set */
  prerender?: boolean
  children: ReactNode
  /** Loading state for auth to distinguish with whileLoading */
  whileLoadingAuth?: () => React.ReactElement | null
}

const IdentityWrapper: WrapperType<Record<string, any>> = ({ children }) => {
  return <>{children}</>
}

export function Set<WrapperProps>(props: SetProps<WrapperProps>) {
  const {
    wrap,
    children,
    private: privateSet,
    unauthenticated,
    role,
    whileLoadingAuth,
    ...rest
  } = props
  const routerState = useRouterState()
  const { loading, isAuthenticated, hasRole } = routerState.useAuth()

  if (privateSet && !unauthenticated) {
    throw new Error(
      'Private Sets need to specify what route to redirect unauthorized users to by setting the `unauthenticated` prop'
    )
  }

  const unauthorized = useCallback(() => {
    return !(isAuthenticated && (!role || hasRole(role)))
  }, [isAuthenticated, role, hasRole])

  // Make sure `wrappers` is always an array with at least one wrapper component
  const wrappers = Array.isArray(wrap) ? wrap : [wrap ? wrap : IdentityWrapper]

  if (privateSet && unauthorized()) {
    if (loading) {
      return whileLoadingAuth?.() || null
    } else {
      const currentLocation =
        global.location.pathname + encodeURIComponent(global.location.search)

      // We already have a check for !unauthenticated further up
      const unauthenticatedPath = namedRoutes[unauthenticated || '']()

      if (!unauthenticatedPath) {
        throw new Error(`We could not find a route named ${unauthenticated}`)
      }

      return (
        <Redirect to={`${unauthenticatedPath}?redirectTo=${currentLocation}`} />
      )
    }
  }

  // Expand and nest the wrapped elements.
  return (
    wrappers.reduceRight<ReduceType>((acc, wrapper) => {
      return React.createElement(wrapper, {
        ...rest,
        children: acc ? acc : children,
      } as SetProps<WrapperProps>)
    }, undefined) || null
  )
}

type PrivateProps<P> = Omit<
  SetProps<P>,
  'private' | 'unauthenticated' | 'wrap'
> & {
  /** The page name where a user will be redirected when not authenticated */
  unauthenticated: string
  wrap?: WrapperType<P> | WrapperType<P>[]
}

export function Private<WrapperProps>(props: PrivateProps<WrapperProps>) {
  const { children, unauthenticated, role, wrap, ...rest } = props

  return (
    // @MARK Doesn't matter that we pass `any` here
    // Because user's still get a typed Private component
    // If we leave `<any>` out, TS will infer the generic argument to be
    // `WrapperProps`, which looks more correct, but it will cause a type
    // error I'm not sure how to solve
    <Set<any>
      private
      unauthenticated={unauthenticated}
      role={role}
      wrap={wrap}
      {...rest}
    >
      {children}
    </Set>
  )
}
