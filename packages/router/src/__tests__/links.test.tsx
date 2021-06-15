import { toHaveClass, toHaveStyle } from '@testing-library/jest-dom/matchers'
import { render } from '@testing-library/react'

import { HistoryProvider } from '@redwoodjs/history'

// TODO: Remove when jest configs are in place
expect.extend({ toHaveClass, toHaveStyle })

import { NavLink, useMatch, Link } from '../links'
import { LocationProvider as RedwoodLocationProvider } from '../location'

const LocationProvider = ({ location, children }) => (
  <HistoryProvider>
    <RedwoodLocationProvider location={location}>
      {children}
    </RedwoodLocationProvider>
  </HistoryProvider>
)
function createDummyLocation(pathname: string) {
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
    search: '',
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

  it('does NOT receive active class on different path', () => {
    const mockLocation = createDummyLocation('/staples')

    const { getByText } = render(
      <LocationProvider location={mockLocation}>
        <MyLink to="/dunder-mifflin">Dunder Mifflin</MyLink>
      </LocationProvider>
    )

    expect(getByText(/Dunder Mifflin/)).toHaveStyle('color: red')
  })
})
