import React, { Children, ReactElement, ReactNode } from 'react'

/** Create a React Context with the given name. */
const createNamedContext = <T extends unknown>(
  name: string,
  defaultValue?: T
) => {
  const Ctx = React.createContext<T | undefined>(defaultValue)
  Ctx.displayName = name
  return Ctx
}

/**
 * Get param name and type transform for a route
 *
 *  '/blog/{year}/{month}/{day:Int}' => [['year'], ['month'], ['day', 'Int']]
 */
const paramsForRoute = (route: string) => {
  // Match the strings between `{` and `}`.
  const params = [...route.matchAll(/\{([^}]+)\}/g)]
  return params
    .map((match) => match[1])
    .map((match) => {
      return match.split(':')
    })
}

export type TrailingSlashesTypes = 'never' | 'always' | 'preserve'
export interface ParamType {
  constraint: RegExp
  transform: (value: any) => unknown
}

/** Definitions of the core param types. */
const coreParamTypes = {
  Int: {
    constraint: /\d+/,
    transform: Number,
  },
  Float: {
    constraint: /[-+]?(?:\d*\.?\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/,
    transform: Number,
  },
  Boolean: {
    constraint: /true|false/,
    transform: (boolAsString: string) => boolAsString === 'true',
  },
}

type SupportedRouterParamTypes = keyof typeof coreParamTypes

/**
 * Determine if the given route is a match for the given pathname. If so,
 * extract any named params and return them in an object.
 *
 * route           - The route path as specified in the <Route path={...} />
 * pathname        - The pathname from the window.location.
 * allParamTypes   - The object containing all param type definitions.
 * trailingSlashes - The option to handle the expected behavior of trailing slashes.
 *
 * Examples:
 *
 *  matchPath('/blog/{year}/{month}/{day}', '/blog/2019/12/07')
 *  => { match: true, params: { year: '2019', month: '12', day: '07' }}
 *
 *  matchPath('/about', '/')
 *  => { match: false }
 *
 *  matchPath('/post/{id:Int}', '/post/7')
 *  => { match: true, params: { id: 7 }}
 */

export const formatPath = (
  path: string,
  trailingSlashes: TrailingSlashesTypes
) => {
  return {
    never: path.replace(/\/$/, ''),
    always: path.endsWith('/') ? path : path + '/',
    preserve: path,
  }[trailingSlashes]
}

const matchPath = (
  path: string,
  locationPathname: string,
  paramTypes?: Record<string, ParamType>,
  trailingSlashes: TrailingSlashesTypes = 'never'
) => {
  const route = formatPath(path, trailingSlashes)
  const pathname = formatPath(locationPathname, trailingSlashes)

  // Get the names and the transform types for the given route.
  const routeParams = paramsForRoute(route)
  const allParamTypes = { ...coreParamTypes, ...paramTypes }
  let typeConstrainedRoute = route

  // Map all params from the route to their type constraint regex to create a "type-constrained route" regexp
  for (const [name, type] of routeParams) {
    let typeRegex = '[^/]+'
    // Undefined constraint if not supported
    // So leaves it as string
    const constraint =
      type && allParamTypes[type as SupportedRouterParamTypes]?.constraint

    if (constraint) {
      // Get the regex as a string
      typeRegex = constraint.source || '[^/]+'
    }

    typeConstrainedRoute = typeConstrainedRoute.replace(
      type ? `{${name}:${type}}` : `{${name}}`,
      `(${typeRegex})`
    )
  }

  // Does the `pathname` match the route?
  const matches = [
    ...pathname.matchAll(new RegExp(`^${typeConstrainedRoute}$`, 'g')),
  ]

  if (matches.length === 0) {
    return { match: false }
  }

  // Map extracted values to their param name, casting the value if needed
  const providedParams = matches[0].slice(1)
  const params = providedParams.reduce<Record<string, unknown>>(
    (acc, value, index) => {
      const [name, transformName] = routeParams[index]
      const typeInfo = allParamTypes[transformName as SupportedRouterParamTypes]

      let transformedValue: string | unknown = value
      if (typeInfo && typeof typeInfo.transform === 'function') {
        transformedValue = typeInfo.transform(value)
      }

      return {
        ...acc,
        [name]: transformedValue,
      }
    },
    {}
  )

  return { match: true, params }
}

/**
 * Parse the given search string into key/value pairs and return them in an
 * object.
 *
 * Examples:
 *
 *  parseSearch('?key1=val1&key2=val2')
 *  => { key1: 'val1', key2: 'val2' }
 *
 * @fixme
 * This utility ignores keys with multiple values such as `?foo=1&foo=2`.
 */
const parseSearch = (
  search:
    | string
    | string[][]
    | Record<string, string>
    | URLSearchParams
    | undefined
) => {
  const searchParams = new URLSearchParams(search)

  return [...searchParams.keys()].reduce(
    (params, key) => ({
      ...params,
      [key]: searchParams.get(key),
    }),
    {}
  )
}

/**
 * Validate a path to make sure it follows the router's rules. If any problems
 * are found, a descriptive Error will be thrown, as problems with routes are
 * critical enough to be considered fatal.
 */
const validatePath = (path: string) => {
  // Check that path begins with a slash.
  if (!path.startsWith('/')) {
    throw new Error(`Route path does not begin with a slash: "${path}"`)
  }

  if (path.indexOf(' ') >= 0) {
    throw new Error(`Route path contains spaces: "${path}"`)
  }

  // Check for duplicate named params.
  const matches = path.matchAll(/\{([^}]+)\}/g)
  const memo: Record<string, boolean> = {}
  for (const match of matches) {
    // Extract the param's name to make sure there aren't any duplicates
    const param = match[1].split(':')[0]
    if (memo[param]) {
      throw new Error(`Route path contains duplicate parameter: "${path}"`)
    } else {
      memo[param] = true
    }
  }
}

/**
 * Take a given route path and replace any named parameters with those in the
 * given args object. Any extra params not used in the path will be appended
 * as key=value pairs in the search part.
 *
 * Examples:
 *
 *   replaceParams('/tags/{tag}', { tag: 'code', extra: 'foo' })
 *   => '/tags/code?extra=foo
 */
const replaceParams = (path: string, args: Record<string, unknown> = {}) => {
  // Split the path apart and replace named parameters with those sent in,
  // then join it back together.
  const parts = path.split('/')
  let newPath = parts
    .map((part) => {
      if (part[0] === '{' && part[part.length - 1] === '}') {
        const paramSpec = part.substr(1, part.length - 2)
        const paramName = paramSpec.split(':')[0]
        const arg = args[paramName]
        if (arg) {
          delete args[paramName]
          return arg
        }
      }
      return part
    })
    .join('/')

  // Prepare any unnamed params to be be appended as search params.
  const queryParams: string[] = []
  Object.keys(args).forEach((key) => {
    queryParams.push(`${key}=${args[key]}`)
  })

  // Append any unnamed params as search params.
  if (queryParams.length) {
    newPath += `?${queryParams.join('&')}`
  }

  return newPath
}

function isReactElement(node: ReactNode): node is ReactElement {
  return (
    node !== undefined &&
    node !== null &&
    (node as ReactElement).type !== undefined
  )
}

function flattenAll(children: ReactNode): ReactNode[] {
  const childrenArray = Children.toArray(children)

  return childrenArray.flatMap((child) => {
    if (isReactElement(child) && child.props.children) {
      return [child, ...flattenAll(child.props.children)]
    }

    return [child]
  })
}

export {
  createNamedContext,
  matchPath,
  parseSearch,
  validatePath,
  replaceParams,
  isReactElement,
  flattenAll,
}

/**
 * gets the announcement for the new page.
 * called in page-loader's `componentDidUpdate`.
 *
 * the order of priority is:
 * 1. RouteAnnouncement (the most specific one)
 * 2. h1
 * 3. document.title
 * 4. location.pathname
 */
export const getAnnouncement = () => {
  const routeAnnouncement = global?.document.querySelectorAll(
    '[data-redwood-route-announcement]'
  )?.[0]
  if (routeAnnouncement?.textContent) {
    return routeAnnouncement.textContent
  }

  const pageHeading = global?.document.querySelector(`h1`)
  if (pageHeading?.textContent) {
    return pageHeading.textContent
  }

  if (global?.document.title) {
    return document.title
  }

  return `new page at ${global?.location.pathname}`
}

export const getFocus = () => {
  const routeFocus = global?.document.querySelectorAll(
    '[data-redwood-route-focus]'
  )?.[0]

  if (
    !routeFocus ||
    !routeFocus.children.length ||
    (routeFocus.children[0] as HTMLElement).tabIndex < 0
  ) {
    return null
  }

  return routeFocus.children[0] as HTMLElement
}

// note: tried document.activeElement.blur(), but that didn't reset the focus flow
export const resetFocus = () => {
  global?.document.body.setAttribute('tabindex', '-1')
  global?.document.body.focus()
  global?.document.body.removeAttribute('tabindex')
}
