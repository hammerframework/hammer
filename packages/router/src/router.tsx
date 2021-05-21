// The guts of the router implementation.

import {
  parseSearch,
  replaceParams,
  matchPath,
  PageLoader,
  Redirect,
  useLocation,
  validatePath,
  LocationProvider,
} from './internal'
import { ParamsProvider } from './params'
import { RouteNameProvider, useRouteName } from './RouteNameContext'
import {
  RouterContextProvider,
  RouterContextProviderProps,
  useRouterState,
} from './router-context'
import { SplashPage } from './splash-page'
import { flattenAll, isReactElement } from './util'

import type { AvailableRoutes } from './index'

// namedRoutes is populated at run-time by iterating over the `<Route />`
// components, and appending them to this object.
const namedRoutes: AvailableRoutes = {}

type PageType =
  | Spec
  | React.ComponentType<unknown>
  | ((props: any) => JSX.Element)

interface RouteProps {
  path: string
  page: PageType
  name: string
  prerender?: boolean
  whileLoading?: () => React.ReactElement | null
}

interface RedirectRouteProps {
  path: string
  redirect: string
}

interface NotFoundRouteProps {
  notfound: boolean
  page: PageType
}

type InternalRouteProps = Partial<
  RouteProps & RedirectRouteProps & NotFoundRouteProps
>

const Route: React.VFC<RouteProps | RedirectRouteProps | NotFoundRouteProps> = (
  props
) => {
  return <InternalRoute {...props} />
}

const InternalRoute: React.VFC<InternalRouteProps> = ({
  path,
  page,
  name,
  redirect,
  notfound,
  // @ts-expect-error - This prop is picked up by <Set>
  whileLoading, // eslint-disable-line
}) => {
  const location = useLocation()
  const routerState = useRouterState()
  const { routeName } = useRouteName()

  if (notfound) {
    // The "notfound" route is handled by <NotFoundChecker>
    return null
  }

  if (!path) {
    throw new Error(`Route "${name}" needs to specify a path`)
  }

  // Check for issues with the path.
  validatePath(path)

  const { match, params: pathParams } = matchPath(
    path,
    location.pathname,
    routerState.paramTypes
  )

  if (!match) {
    return null
  }

  const searchParams = parseSearch(location.search)
  const allParams = { ...pathParams, ...searchParams }

  if (redirect) {
    const newPath = replaceParams(redirect, allParams)
    return <Redirect to={newPath} />
  }

  if (!page || !name) {
    throw new Error(
      "A route that's not a redirect or notfound route needs to specify both a `page` and a `name`"
    )
  }

  if (name !== routeName) {
    // This guards against rendering two pages when the current URL matches two paths
    //   <Route path="/about" page={AboutPage} name="about" />
    //   <Route path="/{param}" page={ParamPage} name="param" />
    // If we go to /about, only the page with name "about" should be rendered
    return null
  }

  return (
    <PageLoader
      spec={normalizePage(page)}
      delay={routerState.pageLoadingDelay}
      params={allParams}
    />
  )
}

function isRoute(
  node: React.ReactNode
): node is React.ReactElement<InternalRouteProps> {
  return isReactElement(node) && node.type === Route
}

interface RouterProps extends RouterContextProviderProps {}

const Router: React.FC<RouterProps> = ({
  useAuth,
  paramTypes,
  pageLoadingDelay,
  children,
}) => {
  const flatChildArray = flattenAll(children)
  const shouldShowSplash =
    flatChildArray.length === 1 &&
    isRoute(flatChildArray[0]) &&
    flatChildArray[0].props.notfound

  if (shouldShowSplash) {
    return <SplashPage />
  }

  // Validate all paths, and populate the named routes map (that is later
  // exported as `routes`).
  flatChildArray.forEach((child) => {
    if (isRoute(child)) {
      const { name, path } = child.props

      if (path) {
        // Check for issues with the path.
        validatePath(path)

        if (name && path) {
          namedRoutes[name] = (args = {}) => replaceParams(path, args)
        }
      }
    }
  })

  return (
    <RouterContextProvider
      useAuth={useAuth}
      paramTypes={paramTypes}
      pageLoadingDelay={pageLoadingDelay}
    >
      <LocationProvider>
        <ParamsProvider>
          <RouteScanner>{children}</RouteScanner>
        </ParamsProvider>
      </LocationProvider>
    </RouterContextProvider>
  )
}

/**
 * Scans all routes for:
 *  - A match to the current location
 *  - The NotFoundPage
 *  - The name of the current route
 *
 * If no matching route is found, and we found a NotFoundPage the NotFoundPage
 * page will be rendered, otherwise the children will be rendered.
 * We need to render all children, and not just the single route that matches
 * the current location in order to also render all layouts etc that might be
 * provided by Sets.
 */
const RouteScanner: React.FC = ({ children }) => {
  const location = useLocation()
  const routerState = useRouterState()

  let foundMatchingRoute = false
  let routeName: string | undefined = undefined
  let NotFoundPage: PageType | undefined = undefined
  const flatChildArray = flattenAll(children)

  for (const child of flatChildArray) {
    if (isRoute(child)) {
      const { path, name } = child.props

      if (path) {
        const { match } = matchPath(
          path,
          location.pathname,
          routerState.paramTypes
        )

        if (match) {
          routeName = name // name is undefined for redirect routes

          foundMatchingRoute = true
          // No need to loop further. As soon as we have a matching route and a
          // route name we have all the info we need
          break
        }
      }

      if (child.props.notfound && child.props.page) {
        NotFoundPage = child.props.page
      }
    }
  }

  return (
    <RouteNameProvider value={{ routeName }}>
      {!foundMatchingRoute && NotFoundPage ? (
        <PageLoader
          spec={normalizePage(NotFoundPage)}
          delay={routerState.pageLoadingDelay}
        />
      ) : (
        children
      )}
    </RouteNameProvider>
  )
}

function isSpec(specOrPage: Spec | React.ComponentType): specOrPage is Spec {
  return (specOrPage as Spec).loader !== undefined
}

export interface Spec {
  name: string
  loader: () => Promise<{ default: React.ComponentType }>
}

/**
 * Pages can be imported automatically or manually. Automatic imports are actually
 * objects and take the following form (which we call a 'spec'):
 *
 *   const WhateverPage = {
 *     name: 'WhateverPage',
 *     loader: () => import('src/pages/WhateverPage')
 *   }
 *
 * Manual imports simply load the page:
 *
 *   import WhateverPage from 'src/pages/WhateverPage'
 *
 * Before passing a "page" to the PageLoader, we will normalize the manually
 * imported version into a spec.
 */
const normalizePage = (specOrPage: Spec | React.ComponentType): Spec => {
  if (isSpec(specOrPage)) {
    // Already a spec, just return it.
    return specOrPage
  }

  // Wrap the Page in a fresh spec, and put it in a promise to emulate
  // an async module import.
  return {
    name: specOrPage.name,
    loader: async () => ({ default: specOrPage }),
  }
}

export { Router, Route, namedRoutes as routes, isRoute, PageType }
