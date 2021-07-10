import {
  BeforeResolverSpec,
  MissingBeforeResolverError,
} from './beforeResolverSpec'
import { ServicesCollection, MakeServices, Services } from './types'

export const makeServices: MakeServices = ({ services }) => {
  if (process.env.REDWOOD_SECURE_SERVICES !== '1') {
    console.warn('NOTICE: Redwood v1.0 will make resolvers secure by default.')
    console.warn(
      'To opt in to this behavior now, add `REDWOOD_SECURE_SERVICES=1` to your `.env.defaults` file. For more information: https://redwoodjs.com/docs/services'
    )
    return services
  }

  const servicesCollection: ServicesCollection = {}

  for (const [name, resolvers] of Object.entries(services)) {
    // if this "service" is actually from the root directory of api/src/services
    // we don't need to check for `beforeResolver` export (it's probably an
    // index file or other shared functionality) but we'll still add it to the
    // collection as normal
    if (!name.match(/_/)) {
      servicesCollection[name] = resolvers
      continue
    }

    if (!resolvers?.beforeResolver) {
      throw new MissingBeforeResolverError(name)
    }

    const spec = new BeforeResolverSpec(Object.keys(resolvers))
    resolvers.beforeResolver(spec)

    const exportResolvers: Services = {}

    for (const [resolverName, resolverFunc] of Object.entries(resolvers)) {
      if (resolverName === 'beforeResolver') {
        continue
      }

      if (typeof resolverFunc === 'function') {
        // wrap resolver function in spec verification
        exportResolvers[resolverName] = (...args: Array<unknown>) => {
          spec.verify(resolverName, args)
          return resolverFunc(...args)
        }
      } else {
        // resolver is just a sub-type, like posts.comments
        exportResolvers[resolverName] = resolverFunc
      }
    }
    servicesCollection[name] = exportResolvers
  }

  return servicesCollection
}
