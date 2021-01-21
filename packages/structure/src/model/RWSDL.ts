import { basename } from 'path'

import { MarkupKind } from 'vscode-languageserver'

import { RWError } from '../errors'
import { CodeLensX, FileNode, HoverX } from '../ide'
import { iter } from '../x/Array'
import { lazy, memo } from '../x/decorators'
import { err, Location_fromNode } from '../x/vscode-languageserver-types'

import { RWProject } from './RWProject'
import { RWSDLField } from './RWSDLField'
import { GraphQLTaggedTemplateLiteral } from './util/GraphQLTaggedTemplateLiteral'
export class RWSDL extends FileNode {
  constructor(public filePath: string, public parent: RWProject) {
    super()
  }
  /**
   * The Template Literal node (string) that contains the schema
   */
  @lazy() get schemaStringNode() {
    return this.schemaTag?.graphqlStringNode
  }
  @lazy() get schemaString(): string | undefined {
    return this.schemaTag?.graphqlString
  }
  @lazy() get serviceFilePath() {
    return this.parent.servicesFilePath(this.name)
  }
  @lazy() get service() {
    return this.parent.services.find((s) => s.name === this.name)
  }
  @lazy() get name() {
    // TODO: support TS
    const base = basename(this.filePath)
    return base.substr(0, base.length - '.sdl.js'.length)
  }
  @lazy() get implementableFields() {
    const self = this
    return iter(function* () {
      const ast = self.schemaTag?.graphqlAST
      if (!ast) return
      for (const def of ast.definitions)
        if (def.kind === 'ObjectTypeDefinition')
          if (def.name.value === 'Query' || def.name.value === 'Mutation')
            for (const field of def.fields ?? [])
              yield new RWSDLField(def, field, self)
    })
  }

  children() {
    return [...this.implementableFields]
  }
  *diagnostics() {
    if (!this.schemaStringNode) {
      yield err(
        this.uri,
        "Each SDL file must export a variable named 'schema' with a GraphQL schema string",
        RWError.SCHEMA_NOT_DEFINED
      )
    }
  }
  *ideInfo() {
    if (this.schemaTag?.graphqlStringNode) {
      const location = Location_fromNode(this.schemaTag.graphqlStringNode)
      yield {
        kind: 'CodeLens',
        location,
        codeLens: {
          range: location.range,
          command: {
            command: 'xx',
            title: 'show generated schema',
          },
        },
      } as CodeLensX

      const schema = this.parent.graphqlHelper.mergedSchemaString
      if (schema)
        yield {
          kind: 'Hover',
          location,
          hover: {
            contents: {
              kind: MarkupKind.Markdown,
              value: ['# Generated Schema', '```graphql', schema, '```'].join(
                '\n'
              ),
            },
            range: location.range,
          },
        } as HoverX
    }
  }
  @lazy() get schemaTag() {
    const getSchema = () => this.parent.graphqlHelper.mergedSchema
    for (const x of GraphQLTaggedTemplateLiteral.findAllInSourceFile(
      this.sf,
      getSchema
    ))
      if (x.variableName === 'schema') return x
  }

  outlineIcon = 'circuit-board'

  @memo() outlineChildren() {
    return [
      ...(this.schemaTag?.graphql_outline || []),
      {
        outlineLabel: 'related service',
        outlineChildren: () => [this.service],
      },
    ]
  }

  outlineLabel = this.basenameNoExt
}
