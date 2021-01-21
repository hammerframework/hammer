import { mergeTypes } from 'merge-graphql-schemas'
import { BaseNode } from 'src/ide'
import { lazy } from '../x/decorators'
import { RWProject } from './RWProject'
import { rootSchema_parsed } from './util/rootSchema'
import { buildSchema, GraphQLSchema } from 'graphql'

export class RWGraphQLHelper extends BaseNode {
  constructor(public parent: RWProject) {
    super()
  }
  @lazy() get id() {
    // this is an internal node. it is not associated to any particular file
    return this.parent.id + ' graphqlHelper'
  }

  bailOutOnCollection() {
    // we need this node to participate in all collection requests
    // because it will emit info and diagnostics for files all over the codebase
    return false
  }
  get mergedSchemaString(): string | undefined {
    try {
      const docs = [
        rootSchema_parsed(),
        ...this.parent.sdls.map((_) => _.schemaTag?.graphqlAST),
      ].filter((_) => typeof _ !== 'undefined')
      const typeDefs = mergeTypes(docs, { all: true })
      return typeDefs
    } catch (e) {
      return undefined
    }
  }
  get mergedSchema(): GraphQLSchema | undefined {
    if (!this.mergedSchemaString) return undefined
    return buildSchema(this.mergedSchemaString)
  }
}
