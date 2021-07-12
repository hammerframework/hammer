import { mergeTypeDefs } from '@graphql-tools/merge'
import {
  addResolveFunctionsToSchema,
  makeExecutableSchema,
  IResolvers,
  IExecutableSchemaDefinition,
} from 'apollo-server-lambda'
import type { GraphQLSchema, GraphQLFieldMap } from 'graphql'
import merge from 'lodash.merge'
import omitBy from 'lodash.omitby'

import { Services, GraphQLTypeWithFields } from 'src/types'

import * as rootSchema from './rootSchema'

const mapFieldsToService = ({
  fields = {},
  resolvers: unmappedResolvers,
  services,
}: {
  fields: GraphQLFieldMap<any, any>
  resolvers: {
    [key: string]: (
      root: unknown,
      args: unknown,
      context: unknown,
      info: unknown
    ) => any
  }
  services: Services
}) =>
  Object.keys(fields).reduce((resolvers, name) => {
    // Does the function already exist in the resolvers from the schema definition?
    if (resolvers?.[name]) {
      return resolvers
    }

    // Does a function exist in the service?
    if (services?.[name]) {
      return {
        ...resolvers,
        // Map the arguments from GraphQL to an ordinary function a service would
        // expect.
        [name]: (
          root: unknown,
          args: unknown,
          context: unknown,
          info: unknown
        ) => services[name](args, { root, context, info }),
      }
    }

    return resolvers
  }, unmappedResolvers)

/**
 * This iterates over all the schemas definitions and figures out which resolvers
 * are missing, it then tries to add the missing resolvers from the corresponding
 * service.
 */
const mergeResolversWithServices = ({
  schema,
  resolvers,
  services,
}: {
  schema: GraphQLSchema
  resolvers: { [key: string]: any }
  services: Services
}): IResolvers => {
  const mergedServices = merge(
    {},
    ...Object.keys(services).map((name) => services[name])
  )

  // Get a list of types that have fields.
  // TODO: Figure out if this would interfere with other types: Interface types, etc.`
  const typesWithFields = Object.keys(schema.getTypeMap())
    .filter((name) => !name.startsWith('_'))
    .filter(
      (name) =>
        typeof (schema.getType(name) as GraphQLTypeWithFields).getFields !==
        'undefined'
    )
    .map((name) => {
      return schema.getType(name)
    })
    .filter(
      (type): type is GraphQLTypeWithFields =>
        type !== undefined && type !== null
    )

  const mappedResolvers = typesWithFields.reduce((acc, type) => {
    // Services export Query and Mutation field resolvers as named exports,
    // but other GraphQLObjectTypes are exported as an object that are named
    // after the type.
    // Example: export const MyType = { field: () => {} }
    let servicesForType = mergedServices
    if (!['Query', 'Mutation'].includes(type.name)) {
      servicesForType = mergedServices?.[type.name]
    }

    return {
      ...acc,
      [type.name]: mapFieldsToService({
        fields: type.getFields(),
        resolvers: resolvers?.[type.name],
        services: servicesForType,
      }),
    }
  }, {})

  return omitBy(
    {
      ...resolvers,
      ...mappedResolvers,
    },
    (v) => typeof v === 'undefined'
  )
}

const mergeResolvers = (schemas: {
  [key: string]: {
    schema: Record<string, unknown>
    resolvers: Record<string, unknown>
  }
}) =>
  omitBy(
    merge(
      {},
      ...[
        rootSchema.resolvers,
        ...Object.values(schemas).map(({ resolvers }) => resolvers),
      ]
    ),
    (v) => typeof v === 'undefined'
  )

/**
 * Merge GraphQL typeDefs and resolvers into a single schema.
 *
 * @example
 * ```js
 * const schemas = importAll('api', 'graphql')
 * const services = importAll('api', 'services')
 *
 * const schema = makeMergedSchema({
 *  schema,
 *  services: makeServices({ services }),
 * })
 * ```
 */

/**
 * Update January 2021
 * Merge GraphQL Schemas has been replaced by @graphql-toolkit/schema-merging
 * The following code proxies the original mergeTypes to the new mergeTypeDefs
 * https://www.graphql-tools.com/docs/migration-from-merge-graphql-schemas/
 **/

type Config = Parameters<typeof mergeTypeDefs>[1]

const mergeTypes = (
  types: any[],
  options?: { schemaDefinition?: boolean; all?: boolean } & Partial<Config>
) => {
  const schemaDefinition =
    options && typeof options.schemaDefinition === 'boolean'
      ? options.schemaDefinition
      : true

  return mergeTypeDefs(types, {
    useSchemaDefinition: schemaDefinition,
    forceSchemaDefinition: schemaDefinition,
    throwOnConflict: true,
    commentDescriptions: true,
    reverseDirectives: true,
    ...options,
  })
}

export const makeMergedSchema = ({
  schemas,
  services,
  schemaOptions,
}: {
  schemas: {
    [key: string]: {
      schema: Record<string, unknown>
      resolvers: Record<string, unknown>
    }
  }
  services: Services
  /**
   * A list of options passed to [makeExecutableSchema](https://www.graphql-tools.com/docs/generate-schema/#makeexecutableschemaoptions).
   */
  schemaOptions?: Partial<IExecutableSchemaDefinition>
}) => {
  const typeDefs = mergeTypes(
    [rootSchema.schema, ...Object.values(schemas).map(({ schema }) => schema)],
    { all: true }
  )

  const schema = makeExecutableSchema({
    typeDefs,
    ...schemaOptions,
  })

  const resolvers: IResolvers = mergeResolversWithServices({
    schema,
    resolvers: mergeResolvers(schemas),
    services,
  })

  const { resolverValidationOptions, inheritResolversFromInterfaces } =
    schemaOptions || {}
  addResolveFunctionsToSchema({
    schema,
    resolvers,
    resolverValidationOptions,
    inheritResolversFromInterfaces,
  })

  return schema
}
