import { toHaveClass, toHaveStyle } from '@testing-library/jest-dom/matchers'
import { render } from '@testing-library/react'
// TODO: Remove when jest configs are in place
expect.extend({ toHaveClass, toHaveStyle })

import { NavLink, useMatch, Link } from '../links'
import { LocationProvider } from '../location'

function createDummyLocation(pathname: string, search = '') {
  return {
    pathname,
    hash: '',
    host: '',
    hostname: '',
    href: '',
    ancestorOrigins: null,
    assign: () => null,
    reload: () => null,
    replace: () => null,
    origin: '',
    port: '',
    protocol: '',
    search,
  }
}

describe('<NavLink />', () => {
  it('receives active class on the same path', () => {
    const mockLocation = createDummyLocation('/dunder-mifflin')

    const { getByText } = render(
      <LocationProvider location={mockLocation}>
        <NavLink activeClassName="activeTest" to="/dunder-mifflin">
          Dunder Mifflin
        </NavLink>
      </LocationProvider>
    )

    expect(getByText(/Dunder Mifflin/)).toHaveClass('activeTest')
  })

  it('receives active class on the same pathname', () => {
    const mockLocation = createDummyLocation('/pathname', '?tab=main&page=1')

    const { getByText } = render(
      <LocationProvider location={mockLocation}>
        <NavLink
          activeClassName="activeTest"
          to={`/pathname?tab=second&page=2`}
          activeMatchOptions={{ ignoreQueryString: true }}
        >
          Dunder Mifflin
        </NavLink>
      </LocationProvider>
    )

    expect(getByText(/Dunder Mifflin/)).toHaveClass('activeTest')
  })

  it('receives active class on the same path and specific search parameters', () => {
    const mockLocation = createDummyLocation(
      '/pathname-params',
      '?tab=main&page=1'
    )

    const { getByText } = render(
      <LocationProvider location={mockLocation}>
        <NavLink
          activeClassName="activeTest"
          to={`/pathname-params?tab=main&page=2`}
          activeMatchOptions={{ matchSearchParamKeys: ['tab'] }}
        >
          Dunder Mifflin
        </NavLink>
      </LocationProvider>
    )

    expect(getByText(/Dunder Mifflin/)).toHaveClass('activeTest')
  })

  it('receives active class on the same path with search parameters', () => {
    const mockLocation = createDummyLocation(
      '/search-params',
      '?tab=main&page=1'
    )

    const { getByText } = render(
      <LocationProvider location={mockLocation}>
        <NavLink
          activeClassName="activeTest"
          to={`/search-params?page=1&tab=main`}
        >
          Dunder Mifflin
        </NavLink>
      </LocationProvider>
    )

    expect(getByText(/Dunder Mifflin/)).toHaveClass('activeTest')
  })

  it('does NOT receive active class on different path', () => {
    const mockLocation = createDummyLocation('/staples')

    const { getByText } = render(
      <LocationProvider location={mockLocation}>
        <NavLink activeClassName="activeTest" to="/dunder-mifflin">
          Dunder Mifflin
        </NavLink>
      </LocationProvider>
    )

    expect(getByText(/Dunder Mifflin/)).not.toHaveClass('activeTest')
  })

  it('does NOT receive active class on the same path with different search parameters', () => {
    const mockLocation = createDummyLocation(
      '/search-params',
      '?tab=main&page=1'
    )

    const { getByText } = render(
      <LocationProvider location={mockLocation}>
        <NavLink
          activeClassName="activeTest"
          to={`/search-params?page=2&tab=main`}
        >
          Dunder Mifflin
        </NavLink>
      </LocationProvider>
    )

    expect(getByText(/Dunder Mifflin/)).not.toHaveClass('activeTest')
  })

  it('does NOT receive active class on the same path but different specific search parameters', () => {
    const mockLocation = createDummyLocation(
      '/pathname-params',
      '?tab=second&page=1'
    )

    const { getByText } = render(
      <LocationProvider location={mockLocation}>
        <NavLink
          activeClassName="activeTest"
          to={`/pathname-params?tab=main&page=2`}
          activeMatchOptions={{ matchSearchParamKeys: ['tab'] }}
        >
          Dunder Mifflin
        </NavLink>
      </LocationProvider>
    )

    expect(getByText(/Dunder Mifflin/)).not.toHaveClass('activeTest')
  })
})

describe('useMatch', () => {
  const MyLink = ({ to, ...rest }) => {
    const matchInfo = useMatch(to)

    return (
      <Link
        to={to}
        style={{ color: matchInfo.match ? 'green' : 'red' }}
        {...rest}
      />
    )
  }

  it('returns a match on the same path', () => {
    const mockLocation = createDummyLocation('/dunder-mifflin')

    const { getByText } = render(
      <LocationProvider location={mockLocation}>
        <MyLink to="/dunder-mifflin">Dunder Mifflin</MyLink>
      </LocationProvider>
    )

    expect(getByText(/Dunder Mifflin/)).toHaveStyle('color: green')
  })

  it('returns a match on the same path with search parameters', () => {
    const mockLocation = createDummyLocation(
      '/search-params',
      '?page=1&tab=main'
    )

    const { getByText } = render(
      <LocationProvider location={mockLocation}>
        <MyLink to={`/search-params?tab=main&page=1`}>Dunder Mifflin</MyLink>
      </LocationProvider>
    )

    expect(getByText(/Dunder Mifflin/)).toHaveStyle('color: green')
  })

  it('does NOT receive active class on different path', () => {
    const mockLocation = createDummyLocation('/staples')

    const { getByText } = render(
      <LocationProvider location={mockLocation}>
        <MyLink to="/dunder-mifflin">Dunder Mifflin</MyLink>
      </LocationProvider>
    )

    expect(getByText(/Dunder Mifflin/)).toHaveStyle('color: red')
  })

  it('does NOT receive active class on the same path with different parameters', () => {
    const mockLocation = createDummyLocation(
      '/search-params',
      '?tab=main&page=1'
    )

    const { getByText } = render(
      <LocationProvider location={mockLocation}>
        <MyLink to={`/search-params?page=2&tab=main`}>Dunder Mifflin</MyLink>
      </LocationProvider>
    )

    expect(getByText(/Dunder Mifflin/)).toHaveStyle('color: red')
  })
})

describe('useMatch - ignoreQueryString option', () => {
  const MyLink = ({ to, ...rest }) => {
    const matchInfo = useMatch(to, { ignoreQueryString: true })

    return (
      <Link
        to={to}
        style={{ color: matchInfo.match ? 'green' : 'red' }}
        {...rest}
      />
    )
  }

  it('returns a match on the same pathname', () => {
    const mockLocation = createDummyLocation('/ignore', '?page=1&tab=main')

    const { getByText } = render(
      <LocationProvider location={mockLocation}>
        <MyLink to={`/ignore?tab=second&page=2`}>Dunder Mifflin</MyLink>
      </LocationProvider>
    )

    expect(getByText(/Dunder Mifflin/)).toHaveStyle('color: green')
  })

  it('does NOT receive active class on different pathname', () => {
    const mockLocation = createDummyLocation('/ignore', '?page=1&tab=main')

    const { getByText } = render(
      <LocationProvider location={mockLocation}>
        <MyLink to={`/ignore2?tab=second&page=2`}>Dunder Mifflin</MyLink>
      </LocationProvider>
    )

    expect(getByText(/Dunder Mifflin/)).toHaveStyle('color: red')
  })
})

describe('useMatch - matchSearchParamKeys option', () => {
  const MyLink = ({ to, ...rest }) => {
    const matchInfo = useMatch(to, { matchSearchParamKeys: ['page'] })

    return (
      <Link
        to={to}
        style={{ color: matchInfo.match ? 'green' : 'red' }}
        {...rest}
      />
    )
  }

  it('returns a match on the same path with specific search parameters', () => {
    const mockLocation = createDummyLocation('/match-keys', '?page=1&tab=main')

    const { getByText } = render(
      <LocationProvider location={mockLocation}>
        <MyLink to={`/match-keys?tab=second&page=1`}>Dunder Mifflin</MyLink>
      </LocationProvider>
    )

    expect(getByText(/Dunder Mifflin/)).toHaveStyle('color: green')
  })

  it('does NOT receive active class on different search parameters', () => {
    const mockLocation = createDummyLocation('/match-keys', '?page=1&tab=main')

    const { getByText } = render(
      <LocationProvider location={mockLocation}>
        <MyLink to={`/match-keys?tab=second&page=2`}>Dunder Mifflin</MyLink>
      </LocationProvider>
    )

    expect(getByText(/Dunder Mifflin/)).toHaveStyle('color: red')
  })
})
