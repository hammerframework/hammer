global.__dirname = __dirname
import path from 'path'

// Load mocks
import 'src/lib/test'

import * as dbAuth from '../dbAuth'

describe('dbAuth', () => {
  it('creates a login page', () => {
    expect(dbAuth.files(true, false)).toHaveProperty([
      path.normalize('/path/to/project/web/src/pages/LoginPage/LoginPage.js'),
    ])
  })

  it('creates a signup page', () => {
    expect(dbAuth.files(true, false)).toHaveProperty([
      path.normalize('/path/to/project/web/src/pages/SignupPage/SignupPage.js'),
    ])
  })

  it('creates a scaffold CSS file', () => {
    expect(dbAuth.files(true, false)).toHaveProperty([
      path.normalize('/path/to/project/web/src/scaffold.css'),
    ])
  })
})
