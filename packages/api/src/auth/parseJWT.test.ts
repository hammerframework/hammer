import { parseJWT } from './parseJWT'

const JWT_CLAIMS = {
  iss: 'https://app.us.auth0.com/',
  sub: 'email|1234',
  aud: ['https://example.com', 'https://app.us.auth0.com/userinfo'],
  iat: 1596481520,
  exp: 1596567920,
  azp: '1l0w6JXXXXL880T',
  scope: 'openid profile email',
}

const JWT_WITH_AUTHORIZATION = {
  app_metadata: { authorization: { roles: ['editor', 'publisher'] } },
  user_metadata: {},
}

const JWT = {
  app_metadata: { roles: ['author'] },
  user_metadata: {},
  ...JWT_CLAIMS,
}

const NAMESPACE = 'https://example.com'
const NAMESPACED_JWT_WITH_AUTHORIZATION = {
  'https://example.com/app_metadata': { authorization: { roles: ['admin'] } },
  'https://example.com/user_metadata': {},
  ...JWT_CLAIMS,
}
const NAMESPACED_JWT = {
  'https://example.com/app_metadata': { roles: ['member'] },
  'https://example.com/user_metadata': {},
  ...JWT_CLAIMS,
}

const JWT_WITH_ROLES_CLAIM = {
  roles: ['customer'],
  ...JWT_CLAIMS,
}

describe('parseJWT', () => {
  describe('handle empty token cases', () => {
    test('it handles null token and returns empty appMetadata and roles', () => {
      const token = { decoded: null, namespace: null }
      expect(parseJWT(token)).toEqual({ appMetadata: {}, roles: [] })
    })

    test('it handles an undefined token and returns empty appMetadata and roles', () => {
      const token = { decoded: undefined, namespace: undefined }
      expect(parseJWT(token)).toEqual({ appMetadata: {}, roles: [] })
    })

    test('it handles an undefined decoded token and returns empty appMetadata and roles', () => {
      const token = { decoded: undefined, namespace: null }
      expect(parseJWT(token)).toEqual({ appMetadata: {}, roles: [] })
    })

    test('it handles an undefined namespace in token and returns empty appMetadata and roles', () => {
      const token = { decoded: null, namespace: undefined }
      expect(parseJWT(token)).toEqual({ appMetadata: {}, roles: [] })
    })
  })

  describe('when the token has an app_metadata custom claim', () => {
    test('it parses and returns appMetadata and expected roles', () => {
      const token = {
        decoded: JWT,
      }
      expect(parseJWT(token)).toEqual({
        appMetadata: { roles: ['author'] },
        roles: ['author'],
      })
    })

    test('it parses and returns appMetadata with authorization and expected roles', () => {
      const token = {
        decoded: JWT_WITH_AUTHORIZATION,
      }
      expect(parseJWT(token)).toEqual({
        appMetadata: { authorization: { roles: ['editor', 'publisher'] } },
        roles: ['editor', 'publisher'],
      })
    })
  })

  describe('when the token has a namespaced app_metadata custom claim', () => {
    test('it parses and returns appMetadata and expected roles', () => {
      const token = {
        decoded: NAMESPACED_JWT,
        namespace: NAMESPACE,
      }
      expect(parseJWT(token)).toEqual({
        appMetadata: { roles: ['member'] },
        roles: ['member'],
      })
    })

    test('it parses and returns appMetadata with authorization and expected roles', () => {
      const token = {
        decoded: NAMESPACED_JWT_WITH_AUTHORIZATION,
        namespace: NAMESPACE,
      }
      expect(parseJWT(token)).toEqual({
        appMetadata: { authorization: { roles: ['admin'] } },
        roles: ['admin'],
      })
    })
  })

  describe('when the token has a roles custom claim', () => {
    test('it parses and returns expected roles', () => {
      const token = {
        decoded: JWT_WITH_ROLES_CLAIM,
      }
      expect(parseJWT(token)).toEqual({
        appMetadata: {},
        roles: ['customer'],
      })
    })
  })
})
