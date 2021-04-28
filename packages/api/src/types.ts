import { GraphQLObjectType, GraphQLInterfaceType } from 'graphql'

export type Resolver = (...args: unknown[]) => unknown
export type Services = {
  [funcName: string]: Resolver
}

// e.g. imported service
// [{ posts_posts: {
// createPost: () => {..},
// deletePost: () => {...}
// }, ]
export type ServicesCollection = {
  [serviceName: string]: Services
}
export interface MakeServicesInterface {
  services: ServicesCollection
}

export type MakeServices = (args: MakeServicesInterface) => ServicesCollection

export type GraphQLTypeWithFields = GraphQLObjectType | GraphQLInterfaceType

export type RuleValidator = (name: string, ...inputs: Array<unknown>) => void
export type ValidatorCollection = {
  validators: Array<RuleValidator>
  skippable: boolean
}

export type SkipArgs = [
  (RuleValidator | Array<RuleValidator> | RuleOptions)?,
  RuleOptions?
]

export type RuleOptions =
  | {
      only: string[]
      except?: undefined
    }
  | {
      except: string[]
      only?: undefined
    }

export interface BeforeResolverSpecType {
  /**
   * @param  {RuleValidator|Array<RuleValidator>} functions - Function or Array of Functions that validates whether service function is allowed to run. Should Throw if not.
   * @param @optional {RuleOptions} options - Pass to selectively apply rule to specific service functions
   */
  add: (
    functions: RuleValidator | Array<RuleValidator>,
    options?: RuleOptions
  ) => void
  skip: (...args: SkipArgs) => void
}
