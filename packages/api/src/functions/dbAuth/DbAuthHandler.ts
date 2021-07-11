import type { PrismaClient } from '@prisma/client'
import type { APIGatewayProxyEvent } from 'aws-lambda'
import CryptoJS from 'crypto-js'
import { v4 as uuidv4 } from 'uuid'

import type { GlobalContext } from '../../globalContext'

import * as DbAuthError from './errors'
import { decryptSession, getSession } from './shared'

interface DbAuthHandlerOptions {
  /**
   * Provide prisma db client
   */
  db: PrismaClient
  /**
   * The name of the property you'd call on `db` to access your user table.
   * ie. if your Prisma model is named `User` this value would be `user`, as in `db.user`
   */
  authModelAccessor: string
  /**
   *  A map of what dbAuth calls a field to what your database calls it.
   * `id` is whatever column you use to uniquely identify a user (probably
   * something like `id` or `userId` or even `email`)
   */
  authFields: {
    id: string
    username: string
    hashedPassword: string
    salt: string
  }
  /**
   * Whatever you want to happen to your data on new user signup. Redwood will
   * check for duplicate usernames before calling this handler. At a minimum
   * you need to save the `username`, `hashedPassword` and `salt` to your
   * user table. `userAttributes` contains any additional object members that
   * were included in the object given to the `signUp()` function you got
   * from `useAuth()`
   */
  signupHandler: (signupHandlerOptions: SignupHandlerOptions) => Promise<any>
  /**
   * How long a user will remain logged in, in seconds
   */
  loginExpires: number
}

interface SignupHandlerOptions {
  username: string
  hashedPassword: string
  salt: string
  userAttributes?: any
}

interface SessionRecord {
  id: string | number
}

type AuthMethodNames = 'login' | 'logout' | 'signup' | 'getToken'

export class DbAuthHandler {
  event: APIGatewayProxyEvent
  context: GlobalContext
  options: DbAuthHandlerOptions
  db: PrismaClient
  dbAccessor: any
  headerCsrfToken: string | undefined
  hasInvalidSession: boolean
  session: SessionRecord | undefined
  sessionCsrfToken: string | undefined

  // class constant: list of auth methods that are supported
  static get METHODS(): AuthMethodNames[] {
    return ['login', 'logout', 'signup', 'getToken']
  }

  // class constant: maps the auth functions to their required HTTP verb for access
  static get VERBS() {
    return {
      login: 'POST',
      logout: 'POST',
      signup: 'POST',
      getToken: 'GET',
    }
  }

  // class constant: all the attributes of the cookie other than the value itself
  static get COOKIE_META() {
    const meta = [`Path=/`, 'HttpOnly', 'SameSite=Strict', 'Secure']

    // set DBAUTH_COOKIE_DOMAIN if you need any subdomains to access this cookie
    if (process.env.DBAUTH_COOKIE_DOMAIN) {
      meta.push(`Domain=${process.env.DBAUTH_COOKIE_DOMAIN}`)
    }

    return meta
  }

  // default to epoch when we want to expire
  static get PAST_EXPIRES_DATE() {
    return new Date('1970-01-01T00:00:00.000+00:00').toUTCString()
  }

  // generate a new token (standard UUID)
  static get CSRF_TOKEN() {
    return uuidv4()
  }

  // convert to the UTC datetime string that's required for cookies
  get _futureExpiresDate() {
    const futureDate = new Date()
    futureDate.setSeconds(futureDate.getSeconds() + this.options.loginExpires)
    return futureDate.toUTCString()
  }

  // returns the Set-Cookie header to mark the cookie as expired ("deletes" the session)
  get _deleteSessionHeader() {
    return {
      'Set-Cookie': [
        'session=',
        ...this._cookieAttributes({ expires: 'now' }),
      ].join(';'),
    }
  }

  constructor(
    event: APIGatewayProxyEvent,
    context: GlobalContext,
    options: DbAuthHandlerOptions
  ) {
    // must have a SESSION_SECRET so we can encrypt/decrypt the cookie
    if (!process.env.SESSION_SECRET) {
      throw new DbAuthError.NoSessionSecret()
    }

    this.event = event
    this.context = context
    this.options = options
    this.db = this.options.db
    this.dbAccessor = this.db[this.options.authModelAccessor]
    this.headerCsrfToken = this.event.headers['x-csrf-token']
    this.hasInvalidSession = false

    try {
      const [session, csrfToken] = decryptSession(
        getSession(this.event.headers['cookie'])
      )
      this.session = session
      this.sessionCsrfToken = csrfToken
    } catch (e) {
      // if session can't be decrypted, keep track so we can log them out when
      // the auth method is called
      if (e instanceof DbAuthError.SessionDecryptionError) {
        this.hasInvalidSession = true
      } else {
        throw e
      }
    }
  }

  // Actual function that triggers everything else to happen:
  // `login`, `logout`, `signup`, or `getToken` is called from here, after some
  // checks to make sure the request is good
  async invoke() {
    // if there was a problem decryption the session, just return the logout
    // response immediately
    if (this.hasInvalidSession) {
      return this._ok(...this._logoutResponse())
    }

    try {
      const method = this._getAuthMethod()

      // get the auth method the incoming request is trying to call
      if (!DbAuthHandler.METHODS.includes(method)) {
        return this._notFound()
      }

      // make sure it's using the correct verb, GET vs POST
      if (this.event.httpMethod !== DbAuthHandler.VERBS[method]) {
        return this._notFound()
      }

      // call whatever auth method was requested and return the body and headers
      const [body, headers, options = { statusCode: 200 }] = await this[
        method
      ]()

      return this._ok(body, headers, options)
    } catch (e) {
      if (e instanceof DbAuthError.WrongVerbError) {
        return this._notFound()
      } else {
        return this._badRequest(e.message)
      }
    }
  }

  async login() {
    const { username, password } = JSON.parse(this.event.body as string)
    const user = await this._verifyUser(username, password)
    const sessionData = { id: user[this.options.authFields.id] }

    // this needs to go into graphql somewhere so that each request makes a new CSRF token
    // and sets it in both the encrypted session and the x-csrf-token header
    const csrfToken = DbAuthHandler.CSRF_TOKEN

    return [
      sessionData,
      {
        'X-CSRF-Token': csrfToken,
        ...this._createSessionHeader(sessionData, csrfToken),
      },
    ]
  }

  logout() {
    return this._logoutResponse()
  }

  async signup() {
    try {
      const user = await this._createUser()
      const sessionData = { id: user[this.options.authFields.id] }
      const csrfToken = DbAuthHandler.CSRF_TOKEN

      return [
        sessionData,
        {
          'X-CSRF-Token': csrfToken,
          ...this._createSessionHeader(sessionData, csrfToken),
        },
        { statusCode: 201 },
      ]
    } catch (e) {
      return this._logoutResponse(e.message)
    }
  }

  // converts the currentUser data to a JWT. returns `null` if session is not present
  async getToken() {
    try {
      const user = await this._getCurrentUser()

      // need to return *something* for our existing Authorization header stuff
      // to work, so return the user's ID in case we can use it for something
      // in the future
      return [user.id]
    } catch (e) {
      if (e instanceof DbAuthError.NotLoggedInError) {
        return this._logoutResponse()
      } else {
        return this._logoutResponse(e.message)
      }
    }
  }

  // returns all the cookie attributes in an array with the proper expiration date
  //
  // pass the argument `expires` set to "now" to get the attributes needed to expire
  // the session, or future (or left out completely) to set to `_futureExpiresDate`
  _cookieAttributes({ expires = 'future' }: { expires?: 'now' | 'future' }) {
    const meta = JSON.parse(JSON.stringify(DbAuthHandler.COOKIE_META))
    const expiresAt =
      expires === 'now'
        ? DbAuthHandler.PAST_EXPIRES_DATE
        : this._futureExpiresDate
    meta.push(`Expires=${expiresAt}`)

    return meta
  }

  _encrypt(data: string) {
    return CryptoJS.AES.encrypt(data, process.env.SESSION_SECRET as string)
  }

  // returns the Set-Cookie header to be returned in the request (effectively creates the session)
  _createSessionHeader(
    data: SessionRecord,
    csrfToken: string
  ): Record<'Set-Cookie', string> {
    const session = JSON.stringify(data) + ';' + csrfToken
    const encrypted = this._encrypt(session)
    const cookie = [
      `session=${encrypted.toString()}`,
      ...this._cookieAttributes({ expires: 'future' }),
    ].join(';')

    return { 'Set-Cookie': cookie }
  }

  // checks the CSRF token in the header against the CSRF token in the session and
  // throw an error if they are not the same (not used yet)
  _validateCsrf() {
    if (this.sessionCsrfToken !== this.headerCsrfToken) {
      throw new DbAuthError.CsrfTokenMismatchError()
    }
    return true
  }

  // verifies that a username and password are correct, and returns the user if so
  async _verifyUser(
    username: string | undefined,
    password: string | undefined
  ) {
    // do we have all the query params we need to check the user?
    if (
      !username ||
      username.toString().trim() === '' ||
      !password ||
      password.toString().trim() === ''
    ) {
      throw new DbAuthError.UsernameAndPasswordRequiredError()
    }

    // does user exist?
    const user = await this.dbAccessor.findUnique({
      where: { [this.options.authFields.username]: username },
    })

    if (!user) {
      throw new DbAuthError.UserNotFoundError(username)
    }

    // is password correct?
    const [hashedPassword, _salt] = this._hashPassword(
      password,
      user[this.options.authFields.salt]
    )
    if (hashedPassword === user[this.options.authFields.hashedPassword]) {
      return user
    } else {
      throw new DbAuthError.IncorrectPasswordError()
    }
  }

  // gets the user from the database and returns only its ID
  async _getCurrentUser() {
    if (!this.session?.id) {
      throw new DbAuthError.NotLoggedInError()
    }

    const user = await this.dbAccessor.findUnique({
      where: { [this.options.authFields.id]: this.session?.id },
      select: { [this.options.authFields.id]: true },
    })

    if (!user) {
      throw new DbAuthError.UserNotFoundError()
    }

    return user
  }

  // creates and returns a user, first checking that the username/password
  // values pass validation
  async _createUser() {
    const { username, password, ...userAttributes } = JSON.parse(
      this.event.body as string
    )
    this._validateField('username', username)
    this._validateField('password', password)

    const user = await this.dbAccessor.findUnique({
      where: { [this.options.authFields.username]: username },
    })
    if (user) {
      throw new DbAuthError.DuplicateUsernameError(username)
    }

    // if we get here everything is good, call the app's signup handler and let
    // them worry about scrubbing data and saving to the DB
    const [hashedPassword, salt] = this._hashPassword(password)
    const newUser = await this.options.signupHandler({
      username,
      hashedPassword,
      salt,
      userAttributes,
    })

    return newUser
  }

  // hashes a password using either the given `salt` argument, or creates a new
  // salt and hashes using that. Either way, returns an array with [hash, salt]
  _hashPassword(text: string, salt?: string) {
    const useSalt = salt || CryptoJS.lib.WordArray.random(128 / 8).toString()

    return [
      CryptoJS.PBKDF2(text, useSalt, { keySize: 256 / 32 }).toString(),
      useSalt,
    ]
  }

  // figure out which auth method we're trying to call
  _getAuthMethod() {
    // try getting it from the query string, /.redwood/functions/auth?method=[methodName]
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    let methodName = this.event.queryStringParameters!.method as AuthMethodNames

    if (!DbAuthHandler.METHODS.includes(methodName) && this.event.body) {
      // try getting it from the body in JSON: { method: [methodName] }
      try {
        methodName = JSON.parse(this.event.body).method
      } catch (e) {
        // there's no body, or it's not JSON, `handler` will return a 404
      }
    }

    return methodName
  }

  // checks that a single field meets validation requirements and
  // currently checks for presense only
  _validateField(name: string, value: string) {
    // check for presense
    if (!value || value.trim() === '') {
      throw new DbAuthError.FieldRequiredError(name)
    } else {
      return true
    }
  }

  _logoutResponse(message?: string): [string, Record<'Set-Cookie', string>] {
    return [
      message ? JSON.stringify({ message }) : '',
      {
        ...this._deleteSessionHeader,
      },
    ]
  }

  _ok(body: string, headers = {}, options = { statusCode: 200 }) {
    return {
      statusCode: options.statusCode,
      body,
      headers: { 'Content-Type': 'application/json', ...headers },
    }
  }

  _notFound() {
    return {
      statusCode: 404,
    }
  }

  _badRequest(message: string) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message }),
      headers: { 'Content-Type': 'application/json' },
    }
  }
}
