import { MissingBeforeResolverError } from '../beforeResolverSpec'
import { makeServices } from '../makeServices'

describe('makeServices', () => {
  let services = []

  // silence warning messages in console
  beforeAll(() => {
    jest.spyOn(console, 'warn')
    console.warn.mockImplementation(() => null)
  })

  afterAll(() => {
    console.warn.mockRestore()
  })

  beforeEach(() => {
    services = {
      posts_posts: {
        beforeResolver: () => {},
        posts: () => {},
        post: () => {},
        createPost: () => {},
        updatePost: () => {},
        deletePost: () => {},
      },
    }
  })

  afterEach(() => {
    delete process.env['REDWOOD_SECURE_SERVICES']
    services = []
  })

  it('returns same services if experimentalSecureService config option is absent', () => {
    const madeServices = makeServices({ services })
    expect(madeServices).toEqual(services)
  })

  it('throws an error if service does not export a beforeResolver()', () => {
    process.env.REDWOOD_SECURE_SERVICES = '1'
    services.posts_posts.beforeResolver = null

    expect(() => {
      makeServices({ services })
    }).toThrow(MissingBeforeResolverError)
  })

  it('does not include beforeResolver() in returned services', () => {
    process.env.REDWOOD_SECURE_SERVICES = '1'

    const madeServices = makeServices({ services })

    expect(Object.keys(madeServices.posts_posts)).not.toContain(
      'beforeResolver'
    )
  })

  it('ignores services that are not in a subdirectory', () => {
    process.env.REDWOOD_SECURE_SERVICES = '1'
    let madeServices

    expect(() => {
      madeServices = makeServices({
        services: { index: { foo: () => {} }, ...services },
      })
    }).not.toThrow()
    // still exports those services
    expect(Object.keys(madeServices)).toContain('index')
  })
})
