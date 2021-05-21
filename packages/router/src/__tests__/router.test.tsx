import React from 'react'

import { render, waitFor, act, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/extend-expect'

import { AuthContextInterface } from '@redwoodjs/auth'

import { Router, Route, Private, Redirect, navigate, routes, Link } from '../'
import { useParams } from '../params'
import { Set } from '../Set'

function createDummyAuthContextValues(partial: Partial<AuthContextInterface>) {
  const authContextValues: AuthContextInterface = {
    loading: true,
    isAuthenticated: false,
    authToken: null,
    userMetadata: null,
    currentUser: null,
    logIn: () => null,
    logOut: () => null,
    signUp: () => null,
    getToken: () => null,
    getCurrentUser: () => null,
    hasRole: () => false,
    reauthenticate: () => null,
    client: null,
    type: 'custom',
    hasError: false,
  }

  return { ...authContextValues, ...partial }
}

const mockUseAuth =
  (
    {
      isAuthenticated = false,
      loading = false,
    }: { isAuthenticated?: boolean; loading?: boolean } = {
      isAuthenticated: false,
      loading: false,
    }
  ) =>
  () =>
    createDummyAuthContextValues({ loading, isAuthenticated })

// SETUP
const HomePage = () => <h1>Home Page</h1>
const LoginPage = () => <h1>Login Page</h1>
const AboutPage = () => <h1>About Page</h1>
const PrivatePage = () => <h1>Private Page</h1>
const RedirectPage = () => <Redirect to="/about" />
const NotFoundPage = () => <h1>404</h1>

beforeEach(() => {
  window.history.pushState({}, null, '/')
  Object.keys(routes).forEach((key) => delete routes[key])
})

test('inits routes and navigates as expected', async () => {
  const ParamPage = ({ value, q }: { value: string; q: string }) => {
    const params = useParams()

    return (
      <div>
        <p>param {`${value}${q}`}</p>
        <p>hookparams {`${params.value}?${params.q}`}</p>
      </div>
    )
  }

  const TestRouter = () => (
    <Router useAuth={mockUseAuth()}>
      <Route path="/" page={HomePage} name="home" />
      <Route path="/about" page={AboutPage} name="about" />
      <Route path="/redirect" page={RedirectPage} name="redirect" />
      <Route path="/redirect2/{value}" redirect="/param-test/{value}" />
      <Private unauthenticated="home">
        <Route path="/private" page={PrivatePage} name="private" />
      </Private>
      <Route path="/param-test/{value}" page={ParamPage} name="params" />
      <Route notfound page={NotFoundPage} />
    </Router>
  )

  const screen = render(<TestRouter />)

  // starts on home page
  await waitFor(() => screen.getByText(/Home Page/i))

  // navigate to about page
  act(() => navigate(routes.about()))
  await waitFor(() => screen.getByText(/About Page/i))

  // passes search params to the page
  act(() => navigate(routes.params({ value: 'val', q: 'q' })))
  await waitFor(() => {
    expect(screen.queryByText('param valq')).toBeInTheDocument()
    expect(screen.queryByText('hookparams val?q')).toBeInTheDocument()
  })

  // navigate to redirect page
  // should redirect to about
  act(() => navigate(routes.redirect()))
  await waitFor(() => {
    expect(screen.queryByText(/Redirect Page/)).not.toBeInTheDocument()
    expect(screen.queryByText(/About Page/)).toBeInTheDocument()
  })

  act(() => navigate('/redirect2/redirected?q=cue'))
  await waitFor(() => screen.getByText(/param redirectedcue/i))

  // navigate to redirect2 page
  // should redirect to /param-test
  act(() => navigate('/redirect2/redirected'))
  await waitFor(() => screen.getByText(/param redirected/))

  act(() => navigate(routes.params({ value: 'one' })))
  await waitFor(() => screen.getByText(/param one/i))

  act(() => navigate(routes.params({ value: 'two' })))
  await waitFor(() => screen.getByText(/param two/i))

  // Renders the notfound page
  act(() => navigate('/no/route/defined'))
  await waitFor(() => screen.getByText('404'))
})

test('unauthenticated user is redirected away from private page', async () => {
  const TestRouter = () => (
    <Router useAuth={mockUseAuth()}>
      <Route path="/" page={HomePage} name="home" />
      <Route path="/login" page={LoginPage} name="login" />
      <Route path="/about" page={AboutPage} name="about" />
      <Private unauthenticated="login">
        <Route path="/private" page={PrivatePage} name="private" />
      </Private>
    </Router>
  )
  const screen = render(<TestRouter />)

  // starts on home page
  await waitFor(() => screen.getByText(/Home Page/i))

  // navigate to private page
  // should redirect to login
  act(() => navigate(routes.private()))

  await waitFor(() => {
    expect(screen.queryByText(/Private Page/i)).not.toBeInTheDocument()
    expect(window.location.pathname).toBe('/login')
    expect(window.location.search).toBe('?redirectTo=/private')
    screen.getByText(/Login Page/i)
  })
})

test('unauthenticated user is redirected including search params', async () => {
  const TestRouter = () => (
    <Router useAuth={mockUseAuth()}>
      <Route path="/" page={HomePage} name="home" />
      <Route path="/login" page={LoginPage} name="login" />
      <Private unauthenticated="login">
        <Route path="/private" page={PrivatePage} name="private" />
      </Private>
    </Router>
  )
  const screen = render(<TestRouter />)

  // starts on home page
  await waitFor(() => screen.getByText(/Home Page/i))

  // navigate to private page
  // should redirect to login
  act(() => navigate(routes.private({ bazinga: 'yeah' })))

  await waitFor(() => {
    expect(screen.queryByText(/Private Page/i)).not.toBeInTheDocument()
    expect(window.location.pathname).toBe('/login')
    expect(window.location.search).toBe(
      `?redirectTo=/private${encodeURIComponent('?bazinga=yeah')}`
    )
    screen.getByText(/Login Page/i)
  })
})

test('authenticated user can access private page', async () => {
  const TestRouter = () => (
    <Router useAuth={mockUseAuth({ isAuthenticated: true })}>
      <Route path="/" page={HomePage} name="home" />
      <Private unauthenticated="home">
        <Route path="/private" page={PrivatePage} name="private" />
      </Private>
    </Router>
  )
  const screen = render(<TestRouter />)

  // starts on home page
  await waitFor(() => screen.getByText(/Home Page/i))

  // navigate to private page
  // should not redirect
  act(() => navigate(routes.private()))
  await waitFor(() => {
    expect(screen.getByText(/Private Page/)).toBeInTheDocument()
    expect(screen.queryByText(/Home Page/)).not.toBeInTheDocument()
  })
})

test('can display a loading screen whilst waiting for auth', async () => {
  const TestRouter = () => (
    <Router useAuth={mockUseAuth({ isAuthenticated: false, loading: true })}>
      <Route path="/" page={HomePage} name="home" />
      <Private unauthenticated="home">
        <Route
          path="/private"
          page={PrivatePage}
          name="private"
          whileLoading={() => <>Loading...</>}
        />
      </Private>
    </Router>
  )
  const screen = render(<TestRouter />)

  // starts on home page
  await waitFor(() => screen.getByText(/Home Page/i))

  // navigate to private page
  // should not redirect
  act(() => navigate(routes.private()))
  await waitFor(() => {
    expect(screen.getByText(/Loading.../)).toBeInTheDocument()
    expect(screen.queryByText(/Home Page/)).not.toBeInTheDocument()
  })
})

test('inits routes two private routes with a space in between and loads as expected', async () => {
  const TestRouter = () => (
    <Router useAuth={mockUseAuth()}>
      <Route path="/" page={HomePage} name="home" />
      <Route path="/about" page={AboutPage} name="about" />
      <Route path="/redirect" page={RedirectPage} name="redirect" />
      <Private unauthenticated="home">
        <Route path="/private" page={PrivatePage} name="private" />{' '}
        <Route path="/another-private" page={PrivatePage} name="private" />
      </Private>

      <Route
        path="/param-test/:value"
        page={({ value }) => <div>param {value}</div>}
        name="params"
      />
    </Router>
  )
  const screen = render(<TestRouter />)

  // starts on home page
  await waitFor(() => screen.getByText(/Home Page/i))
})

test('supports <Set>', async () => {
  const GlobalLayout = ({ children }) => (
    <div>
      <h1>Global Layout</h1>
      {children}
    </div>
  )

  const TestRouter = () => (
    <Router useAuth={mockUseAuth()}>
      <Set wrap={GlobalLayout}>
        <Route path="/" page={HomePage} name="home" />
        <Route path="/about" page={AboutPage} name="about" />
        <Route path="/redirect" page={RedirectPage} name="redirect" />
        <Private unauthenticated="home">
          <Route path="/private" page={PrivatePage} name="private" />
          <Route
            path="/another-private"
            page={PrivatePage}
            name="anotherPrivate"
          />
        </Private>
      </Set>
    </Router>
  )
  const screen = render(<TestRouter />)

  await waitFor(() => screen.getByText(/Global Layout/i))
  await waitFor(() => screen.getByText(/Home Page/i))
})

test("Doesn't destroy <Set> when navigating inside, but does when navigating between", async () => {
  interface ContextState {
    contextValue: string
    setContextValue: React.Dispatch<React.SetStateAction<string>>
  }

  const SetContext = React.createContext<ContextState | undefined>(undefined)

  const SetContextProvider = ({ children }) => {
    const [contextValue, setContextValue] = React.useState('initialSetValue')

    return (
      <SetContext.Provider value={{ contextValue, setContextValue }}>
        {children}
      </SetContext.Provider>
    )
  }

  const Ctx1Page = () => {
    const ctx = React.useContext(SetContext)

    React.useEffect(() => {
      ctx.setContextValue('updatedSetValue')
    }, [ctx])

    return <p>1-{ctx.contextValue}</p>
  }

  const Ctx2Page = () => {
    const ctx = React.useContext(SetContext)

    return <p>2-{ctx.contextValue}</p>
  }

  const Ctx3Page = () => {
    const ctx = React.useContext(SetContext)

    return <p>3-{ctx.contextValue}</p>
  }

  const TestRouter = () => {
    return (
      <Router>
        <Set wrap={SetContextProvider}>
          <Route path="/" page={HomePage} name="home" />
          <Route path="/ctx-1-page" page={Ctx1Page} name="ctx1" />
          <Route path="/ctx-2-page" page={Ctx2Page} name="ctx2" />
        </Set>
        <Set wrap={SetContextProvider}>
          <Route path="/ctx-3-page" page={Ctx3Page} name="ctx3" />
        </Set>
      </Router>
    )
  }

  const screen = render(<TestRouter />)

  await waitFor(() => screen.getByText('Home Page'))

  act(() => navigate(routes.ctx1()))
  await waitFor(() => screen.getByText('1-updatedSetValue'))

  act(() => navigate(routes.ctx2()))
  await waitFor(() => screen.getByText('2-updatedSetValue'))

  act(() => navigate(routes.ctx3()))
  await waitFor(() => screen.getByText('3-initialSetValue'))
})

test('can use named routes for navigating', async () => {
  const MainLayout = ({ children }) => {
    return (
      <div>
        <h1>Main Layout</h1>
        <Link to={routes.home()}>Home-link</Link>
        <Link to={routes.about()}>About-link</Link>
        <hr />
        {children}
      </div>
    )
  }

  const TestRouter = () => (
    <Router>
      <Set wrap={MainLayout}>
        <Route path="/" page={HomePage} name="home" />
        <Route path="/about" page={AboutPage} name="about" />
      </Set>
    </Router>
  )

  const screen = render(<TestRouter />)

  // starts on home page, with MainLayout
  await waitFor(() => screen.getByText(/Home Page/))
  await waitFor(() => screen.getByText(/Main Layout/))

  fireEvent.click(screen.getByText('About-link'))
  await waitFor(() => screen.getByText(/About Page/))
})

test('renders only active path', async () => {
  const AboutLayout = ({ children }) => {
    return (
      <div>
        <h1>About Layout</h1>
        <hr />
        {children}
      </div>
    )
  }

  const LoginLayout = ({ children }) => {
    return (
      <div>
        <h1>Login Layout</h1>
        <hr />
        {children}
      </div>
    )
  }

  const TestRouter = () => (
    <Router>
      <Route path="/" page={HomePage} name="home" />
      <Set wrap={AboutLayout}>
        <Route path="/about" page={AboutPage} name="about" />
      </Set>
      <Set wrap={LoginLayout}>
        <Route path="/login" page={LoginPage} name="login" />
      </Set>
    </Router>
  )

  const screen = render(<TestRouter />)

  // starts on home page, with no layout
  await waitFor(() => screen.getByText(/Home Page/))
  expect(screen.queryByText('About Layout')).not.toBeInTheDocument()
  expect(screen.queryByText('Login Layout')).not.toBeInTheDocument()

  // go to about page, with only about layout
  act(() => navigate(routes.about()))
  await waitFor(() => screen.getByText(/About Page/))
  expect(screen.queryByText('About Layout')).toBeInTheDocument()
  expect(screen.queryByText('Login Layout')).not.toBeInTheDocument()

  // go to login page, with only login layout
  act(() => navigate(routes.login()))
  await waitFor(() => screen.getByText(/Login Page/))
  expect(screen.queryByText('About Layout')).not.toBeInTheDocument()
  expect(screen.queryByText('Login Layout')).toBeInTheDocument()
})

test('renders first matching route only', async () => {
  const ParamPage = ({ param }: { param: string }) => <div>param {param}</div>

  const TestRouter = () => (
    <Router>
      <Route path="/" page={HomePage} name="home" />
      <Route path="/about" page={AboutPage} name="about" />
      <Route path="/{param}" page={ParamPage} name="param" />
    </Router>
  )

  const screen = render(<TestRouter />)

  await waitFor(() => screen.getByText(/Home Page/))

  // go to about page, and make sure that's the only page rendered
  act(() => navigate(routes.about()))
  await waitFor(() => screen.getByText('About Page'))
  expect(screen.queryByText(/param/)).not.toBeInTheDocument()
})

test('renders first matching route only with auth', async () => {
  const ParamPage = ({ param }: { param: string }) => (
    <div>param {param}</div>
  )

  const TestRouter = () => (
    <Router useAuth={mockUseAuth()}>
      <Route path="/" page={HomePage} name="home" />
      <Route path="/login" page={LoginPage} name="login" />
      <Route path="/about" page={AboutPage} name="about" />
      <Private unauthenticated="login">
        <Route path="/{param}" page={ParamPage} name="param" />
      </Private>
    </Router>
  )

  const screen = render(<TestRouter />)

  await waitFor(() => screen.getByText(/Home Page/))

  // go to about page, and make sure that's the only page rendered
  act(() => navigate(routes.about()))
  await waitFor(() => screen.getByText('About Page'))
  expect(screen.queryByText(/param/)).not.toBeInTheDocument()
})

test('params should never be an empty object', async (done) => {
  const ParamPage = () => {
    const params = useParams()
    expect(params).not.toEqual({})
    done()
    return null
  }

  const TestRouter = () => (
    <Router>
      <Route path="/test/{documentId}" page={ParamPage} name="param" />
    </Router>
  )

  act(() => navigate('/test/1'))
  render(<TestRouter />)
})

test('params should never be an empty object in Set', async (done) => {
  const ParamPage = () => {
    return null
  }

  const SetWithUseParams = ({ children }) => {
    const params = useParams()
    expect(params).not.toEqual({})
    done()
    return children
  }

  const TestRouter = () => (
    <Router>
      <Set wrap={SetWithUseParams}>
        <Route path="/test/{documentId}" page={ParamPage} name="param" />
      </Set>
    </Router>
  )

  act(() => navigate('/test/1'))
  render(<TestRouter />)
})

test('params should never be an empty object in Set', async () => {
  const ParamPage = () => {
    const { documentId } = useParams()
    return <>documentId: {documentId}</>
  }

  const SetWithUseParams = ({ children }) => {
    const params = useParams()
    // 1st run: { documentId: '1' }
    // 2rd run: { documentId: '2' }
    expect(params).not.toEqual({})
    return children
  }

  const TestRouter = () => (
    <Router>
      <Set wrap={SetWithUseParams}>
        <Route path="/test/{documentId}" page={ParamPage} name="param" />
      </Set>
      <Route path="/" page={() => <Redirect to="/test/2" />} name="home" />
    </Router>
  )

  act(() => navigate('/test/1'))
  const screen = render(<TestRouter />)
  act(() => navigate('/'))
  await waitFor(() => screen.getByText(/documentId: 2/))
})

test('Set is not rendered for unauthenticated user.', async () => {
  const ParamPage = () => {
    // This should never be called. We should be redirect to login instead.
    expect(false).toBe(true)
    return null
  }

  const SetWithUseParams = ({ children }) => {
    // This should never be called. We should be redirect to login instead.
    expect(false).toBe(true)
    return children
  }

  const TestRouter = () => (
    <Router useAuth={mockUseAuth()}>
      <Set private wrap={SetWithUseParams} unauthenticated="login">
        <Route path="/test/{documentId}" page={ParamPage} name="param" />
      </Set>
      <Route path="/" page={() => <div>home</div>} name="home" />
      <Route path="/login" page={() => <div>auth thyself</div>} name="login" />
    </Router>
  )

  const screen = render(<TestRouter />)
  act(() => navigate('/'))
  act(() => navigate('/test/1'))

  await waitFor(() => screen.getByText(/auth thyself/))
})

test('Private is an alias for Set private', async () => {
  const PrivateLayout = ({ children, theme }) => (
    <div>
      <h1>Private Layout ({theme})</h1>
      {children}
    </div>
  )

  const TestRouter = () => (
    <Router useAuth={mockUseAuth({ isAuthenticated: true })}>
      <Route path="/" page={HomePage} name="home" />
      <Private wrap={PrivateLayout} unauthenticated="home" theme="dark">
        <Route path="/private" page={PrivatePage} name="private" />
      </Private>
    </Router>
  )
  const screen = render(<TestRouter />)

  await waitFor(() => screen.getByText(/Home Page/i))

  act(() => navigate('/private'))
  await waitFor(() => screen.getByText(/Private Layout \(dark\)/))
  await waitFor(() => screen.getByText(/Private Page/))
})
