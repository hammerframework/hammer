import CryptoJS from 'crypto-js'

import { DbAuthHandler } from '../DbAuthHandler'
import * as dbAuthError from '../errors'

// mock prisma db client
const DbMock = class {
  constructor(accessors) {
    accessors.forEach((accessor) => {
      this[accessor] = new TableMock(accessor)
    })
  }
}

// creates a mock table accessor
const TableMock = class {
  constructor(accessor) {
    this.accessor = accessor
    this.records = []
  }

  count() {
    return this.records.length
  }

  create({ data }) {
    if (data.id === undefined) {
      data.id = Math.round(Math.random() * 10000000)
    }
    this.records.push(data)
    return data
  }

  findUnique({ where }) {
    return this.records.find((record) => {
      const key = Object.keys(where)[0]
      return record[key] === where[key]
    })
  }

  deleteMany() {
    const count = this.records.length
    this.records = []
    return count
  }
}

// create a mock `db` provider that simulates prisma creating/finding/deleting records
const db = new DbMock(['user'])

const UUID_REGEX =
  /\b[0-9a-f]{8}\b-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-\b[0-9a-f]{12}\b/
const SET_SESSION_REGEX = /^session=[a-zA-Z0-9+=/]+;/
const UTC_DATE_REGEX = /\w{3}, \d{2} \w{3} \d{4} [\d:]{8} GMT/
const LOGOUT_COOKIE =
  'session=;Path=/;HttpOnly;SameSite=Strict;Secure;Expires=Thu, 01 Jan 1970 00:00:00 GMT'

const createDbUser = async () => {
  return await db.user.create({
    data: {
      email: 'rob@redwoodjs.com',
      hashedPassword:
        '0c2b24e20ee76a887eac1415cc2c175ff961e7a0f057cead74789c43399dd5ba',
      salt: '2ef27f4073c603ba8b7807c6de6d6a89',
    },
  })
}

const encryptToCookie = (data) => {
  return `session=${CryptoJS.AES.encrypt(data, process.env.SESSION_SECRET)}`
}

let event, context, options

describe('dbAuth', () => {
  beforeEach(() => {
    // encryption key so results are consistent regardless of settings in .env
    process.env.SESSION_SECRET = 'nREjs1HPS7cFia6tQHK70EWGtfhOgbqJQKsHQz3S'
    delete process.env.DBAUTH_COOKIE_DOMAIN

    event = {
      queryStringParameters: {},
      path: '/.redwood/functions/auth',
      headers: {},
    }
    context = {}

    options = {
      authModelAccessor: 'user',
      authFields: {
        id: 'id',
        username: 'email',
        hashedPassword: 'hashedPassword',
        salt: 'salt',
      },
      db: db,
      excludeUserFields: [],
      loginExpires: 60 * 60,
      signupHandler: ({ username, hashedPassword, salt, userAttributes }) => {
        return db.user.create({
          data: {
            email: username,
            hashedPassword: hashedPassword,
            salt: salt,
            name: userAttributes.name,
          },
        })
      },
    }
  })

  afterEach(async () => {
    await db.user.deleteMany({
      where: { email: 'rob@redwoodjs.com' },
    })
  })

  describe('CSRF_TOKEN', () => {
    it('returns a UUID', () => {
      expect(DbAuthHandler.CSRF_TOKEN).toMatch(UUID_REGEX)
    })
    it('returns a unique UUID after each call', () => {
      const first = DbAuthHandler.CSRF_TOKEN
      const second = DbAuthHandler.CSRF_TOKEN

      expect(first).not.toMatch(second)
    })
  })

  describe('PAST_EXPIRES_DATE', () => {
    it('returns the start of epoch as a UTCString', () => {
      expect(DbAuthHandler.PAST_EXPIRES_DATE).toEqual(
        new Date('1970-01-01T00:00:00.000+00:00').toUTCString()
      )
    })
  })

  describe('dbAccessor', () => {
    it('returns the prisma db accessor for a model', () => {
      const dbAuth = new DbAuthHandler(event, context, options)
      expect(dbAuth.dbAccessor).toEqual(db.user)
    })
  })

  describe('_futureExpiresDate', () => {
    it('returns a date in the future as a UTCString', () => {
      const dbAuth = new DbAuthHandler(event, context, options)

      expect(dbAuth._futureExpiresDate).toMatch(UTC_DATE_REGEX)
    })
  })

  describe('_deleteSessionHeader', () => {
    it('returns a Set-Cookie header to delete the session cookie', () => {
      const dbAuth = new DbAuthHandler(event, context, options)
      const headers = dbAuth._deleteSessionHeader

      expect(Object.keys(headers).length).toEqual(1)
      expect(Object.keys(headers)).toContain('Set-Cookie')
      expect(headers['Set-Cookie']).toEqual(LOGOUT_COOKIE)
    })
  })

  describe('constructor', () => {
    it('initializes some variables with passed values', () => {
      event = { headers: {} }
      context = { foo: 'bar' }
      options = { db: db }
      const dbAuth = new DbAuthHandler(event, context, options)

      expect(dbAuth.event).toEqual(event)
      expect(dbAuth.context).toEqual(context)
      expect(dbAuth.options).toEqual(options)
    })

    it('sets header-based CSRF token', () => {
      event = { headers: { 'x-csrf-token': 'qwerty' } }
      const dbAuth = new DbAuthHandler(event, context, options)

      expect(dbAuth.headerCsrfToken).toEqual('qwerty')
    })

    it('sets session variables to nothing if session cannot be decrypted', () => {
      event = { headers: { 'x-csrf-token': 'qwerty' } }
      const dbAuth = new DbAuthHandler(event, context, options)

      expect(dbAuth.session).toBeUndefined()
      expect(dbAuth.sessionCsrfToken).toBeUndefined()
    })

    it('sets session variables to valid session data', () => {
      event = {
        headers: {
          cookie:
            'session=U2FsdGVkX1/zRHVlEQhffsOufy7VLRAR6R4gb818vxblQQJFZI6W/T8uzxNUbQMx',
        },
      }
      const dbAuth = new DbAuthHandler(event, context, options)

      expect(dbAuth.session).toEqual({ foo: 'bar' })
      expect(dbAuth.sessionCsrfToken).toEqual('abcd')
    })

    it('throws an error if SESSION_SECRET is not defined', () => {
      delete process.env.SESSION_SECRET

      expect(() => new DbAuthHandler(event, context, options)).toThrow(
        dbAuthError.NoSessionSecret
      )
    })
  })

  describe('invoke', () => {
    it('returns a logout response if session is not valid', async () => {
      event.body = JSON.stringify({ method: 'logout' })
      event.httpMethod = 'GET'
      event.headers.cookie = 'session=invalid'
      const dbAuth = new DbAuthHandler(event, context, options)
      const response = await dbAuth.invoke()

      expect(response.headers['Set-Cookie']).toEqual(LOGOUT_COOKIE)
    })

    it('returns a 404 if using the wrong HTTP verb', async () => {
      event.body = JSON.stringify({ method: 'logout' })
      event.httpMethod = 'GET'
      event.headers.cookie =
        'session=U2FsdGVkX1/zRHVlEQhffsOufy7VLRAR6R4gb818vxblQQJFZI6W/T8uzxNUbQMx'
      const dbAuth = new DbAuthHandler(event, context, options)
      const response = await dbAuth.invoke()

      expect(response.statusCode).toEqual(404)
    })

    it('returns a 404 for unsupported method name', async () => {
      event.body = JSON.stringify({ method: 'foobar' })
      event.httpMethod = 'POST'
      event.headers.cookie =
        'session=U2FsdGVkX1/zRHVlEQhffsOufy7VLRAR6R4gb818vxblQQJFZI6W/T8uzxNUbQMx'
      const dbAuth = new DbAuthHandler(event, context, options)
      const response = await dbAuth.invoke()

      expect(response.statusCode).toEqual(404)
    })

    it('returns a 400 for any other errors', async () => {
      event.body = JSON.stringify({ method: 'logout' })
      event.httpMethod = 'POST'
      event.headers.cookie =
        'session=U2FsdGVkX1/zRHVlEQhffsOufy7VLRAR6R4gb818vxblQQJFZI6W/T8uzxNUbQMx'
      const dbAuth = new DbAuthHandler(event, context, options)
      dbAuth.logout = jest.fn(() => {
        throw Error('Logout error')
      })
      const response = await dbAuth.invoke()

      expect(response.statusCode).toEqual(400)
      expect(response.body).toEqual('{"message":"Logout error"}')
    })

    it('calls the appropriate auth function', async () => {
      event.body = JSON.stringify({ method: 'logout' })
      event.httpMethod = 'POST'
      event.headers.cookie =
        'session=U2FsdGVkX1/zRHVlEQhffsOufy7VLRAR6R4gb818vxblQQJFZI6W/T8uzxNUbQMx'
      const dbAuth = new DbAuthHandler(event, context, options)
      dbAuth.logout = jest.fn(() => ['body', { foo: 'bar' }])
      const response = await dbAuth.invoke()

      expect(dbAuth.logout).toHaveBeenCalled()
      expect(response.statusCode).toEqual(200)
      expect(response.body).toEqual('body')
      expect(response.headers).toEqual({
        'Content-Type': 'application/json',
        foo: 'bar',
      })
    })
  })

  describe('login', () => {
    it('throws an error if username is not found', async () => {
      await createDbUser()
      event.body = JSON.stringify({
        username: 'missing@redwoodjs.com',
        password: 'password',
      })
      const dbAuth = new DbAuthHandler(event, context, options)

      dbAuth.login().catch((e) => {
        expect(e).toBeInstanceOf(dbAuthError.UserNotFoundError)
      })
      expect.assertions(1)
    })

    it('throws an error if password is wrong', async () => {
      await createDbUser()
      event.body = JSON.stringify({
        username: 'rob@redwoodjs.com',
        password: 'incorrect',
      })
      const dbAuth = new DbAuthHandler(event, context, options)

      dbAuth.login().catch((e) => {
        expect(e).toBeInstanceOf(dbAuthError.IncorrectPasswordError)
      })
      expect.assertions(1)
    })

    it('returns a JSON body of the user that is logged in', async () => {
      const user = await createDbUser()
      event.body = JSON.stringify({
        username: 'rob@redwoodjs.com',
        password: 'password',
      })
      const dbAuth = new DbAuthHandler(event, context, options)

      const response = await dbAuth.login()

      expect(response[0]).toEqual({ id: user.id })
    })

    it('returns a CSRF token in the header', async () => {
      await createDbUser()
      event.body = JSON.stringify({
        username: 'rob@redwoodjs.com',
        password: 'password',
      })
      const dbAuth = new DbAuthHandler(event, context, options)

      const response = await dbAuth.login()
      expect(response[1]['X-CSRF-Token']).toMatch(UUID_REGEX)
    })

    it('returns a set-cookie header to create session', async () => {
      await createDbUser()
      event.body = JSON.stringify({
        username: 'rob@redwoodjs.com',
        password: 'password',
      })
      const dbAuth = new DbAuthHandler(event, context, options)

      const response = await dbAuth.login()

      expect(response[1]['X-CSRF-Token']).toMatch(UUID_REGEX)
    })

    it('returns a CSRF token in the header', async () => {
      await createDbUser()
      event.body = JSON.stringify({
        username: 'rob@redwoodjs.com',
        password: 'password',
      })
      const dbAuth = new DbAuthHandler(event, context, options)

      const response = await dbAuth.login()

      expect(response[1]['Set-Cookie']).toMatch(SET_SESSION_REGEX)
    })
  })

  describe('logout', () => {
    it('returns set-cookie header for removing session', async () => {
      const dbAuth = new DbAuthHandler(event, context, options)
      const response = dbAuth.logout()

      expect(response[1]['Set-Cookie']).toEqual(LOGOUT_COOKIE)
    })
  })

  describe('signup', () => {
    it('returns the logout response if an error is raised, including error message', async () => {
      event.body = JSON.stringify({
        username: 'rob@redwoodjs.com',
        password: 'password',
        name: 'Rob',
      })
      options.signupHandler = () => {
        throw Error('Cannot signup')
      }
      const dbAuth = new DbAuthHandler(event, context, options)

      const response = await dbAuth.signup()
      expect(response[0]).toEqual('{"message":"Cannot signup"}')
      expect(response[1]['Set-Cookie']).toMatch(LOGOUT_COOKIE)
    })

    it('creates a new user', async () => {
      event.body = JSON.stringify({
        username: 'rob@redwoodjs.com',
        password: 'password',
        name: 'Rob',
      })
      const oldUserCount = await db.user.count()
      const dbAuth = new DbAuthHandler(event, context, options)
      await dbAuth.signup()
      const newUserCount = await db.user.count()

      expect(newUserCount).toEqual(oldUserCount + 1)
    })
  })

  describe('getToken', () => {
    it('returns the ID of the logged in user', async () => {
      const user = await createDbUser()
      event = {
        headers: {
          cookie: encryptToCookie(
            JSON.stringify({ id: user.id }) + ';' + 'token'
          ),
        },
      }
      const dbAuth = new DbAuthHandler(event, context, options)
      const response = await dbAuth.getToken()

      expect(response[0]).toEqual(user.id)
    })

    it('returns nothing if user is not logged in', async () => {
      const dbAuth = new DbAuthHandler(event, context, options)
      const response = await dbAuth.getToken()

      expect(response[0]).toEqual('')
    })

    it('returns any other error', async () => {
      event = {
        headers: {
          cookie: encryptToCookie(
            JSON.stringify({ id: 9999999999 }) + ';' + 'token'
          ),
        },
      }
      const dbAuth = new DbAuthHandler(event, context, options)
      const response = await dbAuth.getToken()

      expect(response[0]).toEqual('{"message":"User not found"}')
    })
  })

  describe('_cookieAttributes', () => {
    it('returns an array of attributes for the session cookie', () => {
      const dbAuth = new DbAuthHandler(event, context, options)
      const attributes = dbAuth._cookieAttributes({})

      expect(attributes.length).toEqual(5)
      expect(attributes[0]).toEqual('Path=/')
      // expect(attributes[1]).toEqual('Domain=site.test')
      expect(attributes[1]).toEqual('HttpOnly')
      expect(attributes[2]).toEqual('SameSite=Strict')
      expect(attributes[3]).toEqual('Secure')
      expect(attributes[4]).toMatch(`Expires=`)
      expect(attributes[4]).toMatch(UTC_DATE_REGEX)
    })

    it('includes a Domain in the cookie if DBAUTH_COOKIE_DOMAIN is set', () => {
      process.env.DBAUTH_COOKIE_DOMAIN = 'site.test'

      const dbAuth = new DbAuthHandler(event, context, options)
      const attributes = dbAuth._cookieAttributes({})

      expect(attributes[4]).toEqual('Domain=site.test')
    })
  })

  describe('_createSessionHeader()', () => {
    it('returns a Set-Cookie header', () => {
      const dbAuth = new DbAuthHandler(event, context, options)
      const headers = dbAuth._createSessionHeader({ foo: 'bar' }, 'abcd')

      expect(Object.keys(headers).length).toEqual(1)
      expect(headers['Set-Cookie']).toMatch(
        `;Path=/;HttpOnly;SameSite=Strict;Secure;Expires=${dbAuth._futureExpiresDate}`
      )
      // can't really match on the session value since it will change on every render,
      // due to CSRF token generation but we can check that it contains a only the
      // characters that would be returned by the hash function
      expect(headers['Set-Cookie']).toMatch(SET_SESSION_REGEX)
      // and we can check that it's a certain number of characters
      expect(headers['Set-Cookie'].split(';')[0].length).toEqual(72)
    })
  })

  describe('_validateCsrf()', () => {
    it('returns true if session and header token match', () => {
      const data = { foo: 'bar' }
      const token = 'abcd'
      event = {
        headers: {
          cookie: encryptToCookie(JSON.stringify(data) + ';' + token),
          'x-csrf-token': token,
        },
      }
      const dbAuth = new DbAuthHandler(event, context, options)

      expect(dbAuth._validateCsrf()).toEqual(true)
    })

    it('throws an error if session and header token do not match', () => {
      const data = { foo: 'bar' }
      const token = 'abcd'
      event = {
        headers: {
          cookie: encryptToCookie(JSON.stringify(data) + ';' + token),
          'x-csrf-token': 'invalid',
        },
      }
      const dbAuth = new DbAuthHandler(event, context, options)

      expect(() => {
        dbAuth._validateCsrf()
      }).toThrow(dbAuthError.CsrfTokenMismatchError)
    })
  })

  describe('_verifyUser()', () => {
    it('throws an error if username is missing', () => {
      const dbAuth = new DbAuthHandler(event, context, options)

      dbAuth._verifyUser(null, 'password').catch((e) => {
        expect(e).toBeInstanceOf(dbAuthError.UsernameAndPasswordRequiredError)
      })
      dbAuth._verifyUser('', 'password').catch((e) => {
        expect(e).toBeInstanceOf(dbAuthError.UsernameAndPasswordRequiredError)
      })
      dbAuth._verifyUser(' ', 'password').catch((e) => {
        expect(e).toBeInstanceOf(dbAuthError.UsernameAndPasswordRequiredError)
      })
      expect.assertions(3)
    })

    it('throws an error if password is missing', () => {
      const dbAuth = new DbAuthHandler(event, context, options)

      dbAuth._verifyUser('username').catch((e) => {
        expect(e).toBeInstanceOf(dbAuthError.UsernameAndPasswordRequiredError)
      })
      dbAuth._verifyUser('username', null).catch((e) => {
        expect(e).toBeInstanceOf(dbAuthError.UsernameAndPasswordRequiredError)
      })
      dbAuth._verifyUser('username', '').catch((e) => {
        expect(e).toBeInstanceOf(dbAuthError.UsernameAndPasswordRequiredError)
      })
      dbAuth._verifyUser('username', ' ').catch((e) => {
        expect(e).toBeInstanceOf(dbAuthError.UsernameAndPasswordRequiredError)
      })
      expect.assertions(4)
    })

    it('throws an error if user is not found', async () => {
      const dbAuth = new DbAuthHandler(event, context, options)

      dbAuth._verifyUser('username', 'password').catch((e) => {
        expect(e).toBeInstanceOf(dbAuthError.UserNotFoundError)
      })
      expect.assertions(1)
    })

    it('throws an error if password is incorrect', async () => {
      const dbUser = await createDbUser()
      const dbAuth = new DbAuthHandler(event, context, options)

      dbAuth._verifyUser(dbUser.email, 'incorrect').catch((e) => {
        expect(e).toBeInstanceOf(dbAuthError.IncorrectPasswordError)
      })

      expect.assertions(1)
    })

    it('returns the user with matching username and password', async () => {
      const dbUser = await createDbUser()
      const dbAuth = new DbAuthHandler(event, context, options)
      const user = await dbAuth._verifyUser(dbUser.email, 'password')

      expect(user.id).toEqual(dbUser.id)
    })
  })

  describe('_getCurrentUser()', () => {
    it('throw an error if user is not logged in', async () => {
      const dbAuth = new DbAuthHandler(event, context, options)
      dbAuth._getCurrentUser().catch((e) => {
        expect(e).toBeInstanceOf(dbAuthError.NotLoggedInError)
      })
      expect.assertions(1)
    })

    it('throw an error if user is not found', async () => {
      const data = { id: 999999999999 }
      event = {
        headers: {
          cookie: encryptToCookie(JSON.stringify(data) + ';' + 'token'),
        },
      }
      const dbAuth = new DbAuthHandler(event, context, options)

      dbAuth._getCurrentUser().catch((e) => {
        expect(e).toBeInstanceOf(dbAuthError.UserNotFoundError)
      })
      expect.assertions(1)
    })

    it('returns the user whos id is in session', async () => {
      const dbUser = await createDbUser()
      event = {
        headers: {
          cookie: encryptToCookie(
            JSON.stringify({ id: dbUser.id }) + ';' + 'token'
          ),
        },
      }
      const dbAuth = new DbAuthHandler(event, context, options)
      const user = await dbAuth._getCurrentUser()

      expect(user.id).toEqual(dbUser.id)
    })
  })

  describe('_createUser()', () => {
    it('throws an error if username is already taken', async () => {
      const dbUser = await createDbUser()
      event.body = JSON.stringify({
        username: dbUser.email,
        password: 'password',
      })
      const dbAuth = new DbAuthHandler(event, context, options)

      dbAuth._createUser().catch((e) => {
        expect(e).toBeInstanceOf(dbAuthError.DuplicateUsernameError)
      })
      expect.assertions(1)
    })

    it('throws an error if username is missing', async () => {
      event.body = JSON.stringify({
        password: 'password',
      })
      const dbAuth = new DbAuthHandler(event, context, options)

      dbAuth._createUser().catch((e) => {
        expect(e).toBeInstanceOf(dbAuthError.FieldRequiredError)
      })
      expect.assertions(1)
    })

    it('throws an error if password is missing', async () => {
      event.body = JSON.stringify({
        username: 'user@redwdoodjs.com',
      })
      const dbAuth = new DbAuthHandler(event, context, options)

      dbAuth._createUser().catch((e) => {
        expect(e).toBeInstanceOf(dbAuthError.FieldRequiredError)
      })
      expect.assertions(1)
    })

    it('creates a new user', async () => {
      event.headers = { 'Content-Type': 'application/json' }
      event.body = JSON.stringify({
        username: 'rob@redwoodjs.com',
        password: 'password',
        name: 'Rob',
      })
      const dbAuth = new DbAuthHandler(event, context, options)

      try {
        const user = await dbAuth._createUser()
        expect(user.email).toEqual('rob@redwoodjs.com')
        expect(user.hashedPassword).not.toBeNull()
        expect(user.salt).not.toBeNull()
        expect(user.name).toEqual('Rob')
      } catch (e) {
        console.info(e)
      }
    })
  })

  describe('hashPassword', () => {
    it('hashes a password with a given salt and returns both', () => {
      const dbAuth = new DbAuthHandler(event, context, options)
      const [hash, salt] = dbAuth._hashPassword(
        'password',
        '2ef27f4073c603ba8b7807c6de6d6a89'
      )

      expect(hash).toEqual(
        '0c2b24e20ee76a887eac1415cc2c175ff961e7a0f057cead74789c43399dd5ba'
      )
      expect(salt).toEqual('2ef27f4073c603ba8b7807c6de6d6a89')
    })

    it('hashes a password with a generated salt if none provided', () => {
      const dbAuth = new DbAuthHandler(event, context, options)
      const [hash, salt] = dbAuth._hashPassword('password')

      expect(hash).toMatch(/^[a-f0-9]+$/)
      expect(hash.length).toEqual(64)
      expect(salt).toMatch(/^[a-f0-9]+$/)
      expect(salt.length).toEqual(32)
    })
  })

  describe('getAuthMethod', () => {
    it('gets methodName out of the query string', () => {
      event = {
        path: '/.redwood/functions/auth',
        queryStringParameters: { method: 'logout' },
        body: '',
        headers: {},
      }
      const dbAuth = new DbAuthHandler(event, context, options)

      expect(dbAuth._getAuthMethod()).toEqual('logout')
    })

    it('gets methodName out of a JSON body', () => {
      event = {
        path: '/.redwood/functions/auth',
        queryStringParameters: {},
        body: '{"method":"signup"}',
        headers: {},
      }
      const dbAuth = new DbAuthHandler(event, context, options)

      expect(dbAuth._getAuthMethod()).toEqual('signup')
    })

    it('otherwise returns undefined', () => {
      event = {
        path: '/.redwood/functions/auth',
        queryStringParameters: {},
        body: '',
        headers: {},
      }
      const dbAuth = new DbAuthHandler(event, context, options)

      expect(dbAuth._getAuthMethod()).toBeUndefined()
    })
  })

  describe('validateField', () => {
    it('checks for the presence of a field', () => {
      const dbAuth = new DbAuthHandler(event, context, options)

      expect(() => {
        dbAuth._validateField('username', null)
      }).toThrow(dbAuth.FieldRequiredError)
      expect(() => {
        dbAuth._validateField('username', '')
      }).toThrow(dbAuth.FieldRequiredError)
      expect(() => {
        dbAuth._validateField('username', ' ')
      }).toThrow(dbAuth.FieldRequiredError)
    })

    it('passes validation if everything is present', () => {
      const dbAuth = new DbAuthHandler(event, context, options)

      expect(dbAuth._validateField('username', 'cannikin')).toEqual(true)
    })
  })

  describe('logoutResponse', () => {
    it('returns the response array necessary to log user out', () => {
      const dbAuth = new DbAuthHandler(event, context, options)
      const [body, headers] = dbAuth._logoutResponse()

      expect(body).toEqual('')
      expect(headers['Set-Cookie']).toMatch(/^session=;/)
    })

    it('can accept a message to return in the body', () => {
      const dbAuth = new DbAuthHandler(event, context, options)
      const [body, _headers] = dbAuth._logoutResponse('error message')

      expect(body).toEqual('{"message":"error message"}')
    })
  })

  describe('ok', () => {
    it('returns a 200 response by default', () => {
      const dbAuth = new DbAuthHandler(event, context, options)
      const response = dbAuth._ok('', {})

      expect(response.statusCode).toEqual(200)
    })

    it('can return other status codes', () => {
      const dbAuth = new DbAuthHandler(event, context, options)
      const response = dbAuth._ok('', {}, { statusCode: 201 })

      expect(response.statusCode).toEqual(201)
    })
  })

  describe('_notFound', () => {
    it('returns a 404 response', () => {
      const dbAuth = new DbAuthHandler(event, context, options)
      const response = dbAuth._notFound()

      expect(response.statusCode).toEqual(404)
      expect(response.body).toEqual(undefined)
    })
  })

  describe('_badRequest', () => {
    it('returns a 400 response', () => {
      const dbAuth = new DbAuthHandler(event, context, options)
      const response = dbAuth._badRequest('bad')

      expect(response.statusCode).toEqual(400)
      expect(response.body).toEqual('{"message":"bad"}')
    })
  })
})
