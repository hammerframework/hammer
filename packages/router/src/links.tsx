import { forwardRef, useEffect } from 'react'

import isEqual from 'lodash.isequal'

import { navigate, matchPath, useLocation, parseSearch } from './internal'

type MatchHookOptions =
  | { matchSearchParamKeys?: string[]; ignoreQueryString?: never | false }
  | {
      ignoreQueryString: true
      matchSearchParamKeys?: never
    }

/**
 * Returns true if the URL for the given "route" value matches the current URL.
 * i.e pathname and search parameters (query string) are both match
 *
 * This is useful for components that need to know "active" state, e.g.
 * <NavLink>.
 *
 * Examples:
 *
 * Match pathname only (ignore search parameters/query string), e.g. match /about only in this case
 * const match = useMatch('/about?tab=main&name=test', {ignoreQueryString: true})
 *
 *
 * Match specific search parameters only, e.g match tab=main only
 * const match = useMatch('/about?tab=main&name=test', {matchSearchParamKeys: ['tab']})
 *
 */
const useMatch = (route: string, options?: MatchHookOptions) => {
  const location = useLocation()
  if (!location) {
    return { match: false }
  }

  // Separate pathname and search parameters, USVString expected
  const [pathname, search] = route.split('?')

  if (!options?.ignoreQueryString) {
    const filterParams = (searchParams: ReturnType<typeof parseSearch>) => {
      if (options?.matchSearchParamKeys?.length) {
        const matchSearchParamKeys = options.matchSearchParamKeys

        return [...Object.keys(searchParams)].reduce((params, key) => {
          if (matchSearchParamKeys.includes(key)) {
            return {
              ...params,
              [key]: (searchParams as Record<string, unknown>)[key],
            }
          }

          return params
        }, {})
      }

      return searchParams
    }

    if (
      !isEqual(
        filterParams(parseSearch(search)),
        filterParams(parseSearch(location.search))
      )
    ) {
      return { match: false }
    }
  }

  return matchPath(pathname, location.pathname)
}

interface LinkProps {
  to: string
}

const Link = forwardRef<
  HTMLAnchorElement,
  LinkProps & React.AnchorHTMLAttributes<HTMLAnchorElement>
>(({ to, onClick, ...rest }, ref) => (
  <a
    href={to}
    ref={ref}
    {...rest}
    onClick={(event) => {
      if (
        event.button !== 0 ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey
      ) {
        return
      }

      event.preventDefault()

      if (onClick) {
        const result = onClick(event)
        if (typeof result !== 'boolean' || result) {
          navigate(to)
        }
      } else {
        navigate(to)
      }
    }}
  />
))

interface NavLinkProps {
  to: string
  activeClassName: string
  activeMatchOptions?: MatchHookOptions
}

const NavLink = forwardRef<
  HTMLAnchorElement,
  NavLinkProps & React.AnchorHTMLAttributes<HTMLAnchorElement>
>(
  (
    { to, activeClassName, activeMatchOptions, className, onClick, ...rest },
    ref
  ) => {
    const matchInfo = useMatch(to, activeMatchOptions)
    const theClassName = [className, matchInfo.match && activeClassName]
      .filter(Boolean)
      .join(' ')

    return (
      <a
        href={to}
        ref={ref}
        className={theClassName}
        {...rest}
        onClick={(event) => {
          if (
            event.button !== 0 ||
            event.altKey ||
            event.ctrlKey ||
            event.metaKey ||
            event.shiftKey
          ) {
            return
          }

          event.preventDefault()

          if (onClick) {
            const result = onClick(event)
            if (typeof result !== 'boolean' || result) {
              navigate(to)
            }
          } else {
            navigate(to)
          }
        }}
      />
    )
  }
)

interface RedirectProps {
  /** The name of the route to redirect to */
  to: string
}

/**
 * A declarative way to redirect to a route name
 */
const Redirect = ({ to }: RedirectProps) => {
  useEffect(() => navigate(to), [to])
  return null
}

export { Link, NavLink, useMatch, Redirect }
