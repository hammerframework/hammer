/**
 * @jest-environment jsdom
 */

import { render, screen, waitFor } from '@testing-library/react'

import type { AuthContextInterface } from '@redwoodjs/auth'
import '@testing-library/jest-dom/extend-expect'

// @ts-expect-error Mocking api proxy path for test
global.__REDWOOD__API_PROXY_PATH = 'https://api.example.com'

import { FetchConfigProvider, useFetchConfig } from './FetchConfigProvider'

const FetchConfigToString: React.FunctionComponent = () => {
  const c = useFetchConfig()
  return <>{JSON.stringify(c)}</>
}

describe('FetchConfigProvider', () => {
  test('Unauthenticated user does not receive headers', () => {
    render(
      <FetchConfigProvider
        useAuth={() =>
          ({
            loading: false,
            isAuthenticated: false,
          } as AuthContextInterface)
        }
      >
        <FetchConfigToString />
      </FetchConfigProvider>
    )

    expect(
      screen.getByText('{"uri":"https://api.example.com/graphql"}')
    ).toBeInTheDocument()
  })

  test('Authenticated user does receive headers', async () => {
    render(
      <FetchConfigProvider
        useAuth={() =>
          ({
            loading: false,
            isAuthenticated: true,
            type: 'custom',
          } as AuthContextInterface)
        }
      >
        <FetchConfigToString />
      </FetchConfigProvider>
    )
    await waitFor(() =>
      screen.getByText(
        '{"uri":"https://api.example.com/graphql","headers":{"auth-provider":"custom"}}'
      )
    )
  })
})
