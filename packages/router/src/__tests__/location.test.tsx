import { render } from '@testing-library/react'
import '@testing-library/jest-dom/extend-expect'

import { HistoryProvider } from '@redwoodjs/history'

import { LocationProvider, useLocation } from '../location'

describe('useLocation', () => {
  const TestComponent = () => {
    const location = useLocation()
    return (
      <div>
        <p>{JSON.stringify(location)}</p>
        <input data-testid="pathname" defaultValue={location.pathname} />
        <input data-testid="search" defaultValue={location.search} />
        <input data-testid="hash" defaultValue={location.hash} />
      </div>
    )
  }

  it('returns the correct pathname, search, and hash values', () => {
    const mockLocation = {
      pathname: '/dunder-mifflin',
      search: '?facts=bears',
      hash: '#woof',
    }

    const { getByText, getByTestId } = render(
      <HistoryProvider>
        <LocationProvider location={mockLocation}>
          <TestComponent />
        </LocationProvider>
      </HistoryProvider>
    )

    expect(
      getByText(
        '{"pathname":"/dunder-mifflin","search":"?facts=bears","hash":"#woof"}'
      )
    ).toBeInTheDocument()
    expect(getByTestId('pathname')).toHaveValue('/dunder-mifflin')
    expect(getByTestId('search')).toHaveValue('?facts=bears')
    expect(getByTestId('hash')).toHaveValue('#woof')
  })
})
