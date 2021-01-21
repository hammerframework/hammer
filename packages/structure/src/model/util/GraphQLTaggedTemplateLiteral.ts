import {
  DocumentNode,
  GraphQLSchema,
  Location as GraphQLLocation,
  parse as parseGraphQL,
} from 'graphql'
import {
  getOutline,
  getTokenAtPosition,
  getTypeInfo,
  getHoverInformation,
} from 'graphql-language-service-interface'
import { ContextToken } from 'graphql-language-service-parser'
import {
  Outline,
  OutlineTree,
  Position as GQLLSPosition,
  Position,
} from 'graphql-language-service-types'
import lineColumn from 'line-column'
import * as tsm from 'ts-morph'
import { Location as LSPLocation } from 'vscode-languageserver-types'

import { lazy } from '../../x/decorators'
import { URL_file } from '../../x/URL'
import { Position_fromTSMorphOffset } from '../../x/vscode-languageserver-types'
import { OutlineInfoProvider } from '../types'

/**
 * A utility wrapper to work with gql`` tagged template literals
 */
export class GraphQLTaggedTemplateLiteral {
  constructor(
    public variableDeclaration: tsm.VariableDeclaration,
    public getSchema?: () => GraphQLSchema | undefined
  ) {}

  @lazy() get variableName() {
    return this.variableDeclaration.getName()
  }

  @lazy() get graphqlStringNode() {
    const i = this.variableDeclaration.getInitializer()
    if (!i) return undefined
    if (!tsm.Node.isTaggedTemplateExpression(i)) return undefined
    const tag = i.getTag().getText()
    if (!(tag === 'graphql' || tag === 'gql')) return undefined
    const t = i.getTemplate()
    // do we allow substitutions?
    if (!tsm.Node.isNoSubstitutionTemplateLiteral(t)) return undefined
    return t
  }

  @lazy() get graphqlString(): string | undefined {
    return this.graphqlStringNode?.getLiteralText()
  }

  /**
   * will try to parse the GraphQL string into a GraphQL AST Document Node
   */
  @lazy() get graphqlAST(): DocumentNode | undefined {
    try {
      const qs = this.graphqlString
      if (!qs) return undefined
      return parseGraphQL(qs)
    } catch (e) {
      return undefined
    }
  }

  /**
   * If the graphql literal declares an operation (ex query foo() or mutation foo())
   * then this will return "foo"
   */
  @lazy() get operationName(): string | undefined {
    for (const def of this.graphqlAST?.definitions ?? [])
      if (def.kind == 'OperationDefinition') return def?.name?.value
  }

  /**
   * Convert a GraphQL location within this literal
   * to a LSP (Language Server Protocol) Location
   * @param loc_gql
   */
  loc__gql_to_lsp(
    loc_gql: Pick<GraphQLLocation, 'start' | 'end'>
  ): LSPLocation | undefined {
    const node = this.graphqlStringNode
    if (!node) return
    const sf = node.getSourceFile()
    const { start, end } = loc_gql
    const offset = node.getPos() + 1 // add one to account for the quote (`)
    const startPos = Position_fromTSMorphOffset(start + offset, sf)
    const endPos = Position_fromTSMorphOffset(end + offset, sf)
    const uri = URL_file(sf.getFilePath())
    return { uri, range: { start: startPos, end: endPos } }
  }

  // loc__lsp_to_gql(loc: LSPLocation) {
  //   // TODO
  // }

  static *findAllInSourceFile(
    sf: tsm.SourceFile,
    getSchema?: () => GraphQLSchema | undefined
  ) {
    for (const vd of sf.getVariableDeclarations()) {
      const x = new GraphQLTaggedTemplateLiteral(vd, getSchema)
      if (x.graphqlStringNode) yield x
    }
  }

  private mapLocation2: MapLocation = (o) => {
    const start = GQLLSPosition_to_offset(o.startPosition, this.graphqlString!)
    const end = o.endPosition
      ? GQLLSPosition_to_offset(o.endPosition, this.graphqlString!)
      : undefined
    return this.loc__gql_to_lsp({ start, end: end ? end : start + 1 })
  }

  @lazy() get schema() {
    return this.getSchema?.()
  }

  private getTooltipCB = (o: OutlineTree): string | undefined => {
    const { schema, graphqlString } = this
    if (!schema || !graphqlString) return '(no schema info)'
    const pp: typeof o.startPosition = { ...o.startPosition }
    // pp.line++
    pp.character++
    const info = getHoverInformation(schema, graphqlString, pp)
    const typeInfo = getTypeInfoAtPosition(schema, graphqlString, pp)
    return JSON.stringify([info, o.plainText, typeInfo], null, 2)
    // return 'type info: ' + JSON.stringify(typeInfo, null, 2)
  }

  @lazy() get graphql_outline() {
    const o = this.graphql_outline_raw
    if (!o) return
    return ppp(o, this.mapLocation2.bind(this), this.getTooltipCB.bind(this))
  }

  @lazy() get graphql_outline_raw() {
    const { graphqlString } = this
    if (!graphqlString) return
    try {
      return getOutline(graphqlString)
    } catch (e) {
      return undefined
    }
  }
}

type MapLocation = (
  o: Pick<OutlineTree, 'startPosition' | 'endPosition'>
) => LSPLocation | undefined

function ppp(
  o: Outline,
  ml: MapLocation,
  tooltip: (o: OutlineTree) => string | undefined
): OutlineInfoProvider[] {
  return o.outlineTrees.map(pppp)
  function pppp(o: OutlineTree): OutlineInfoProvider {
    return {
      outlineLabel: o.representativeName,
      outlineDescription: o.kind,
      outlineIcon: kind2icon[o.kind],
      outlineLocation: ml(o),
      outlineTooltip: tooltip(o),
      outlineChildren: () => o.children.map(pppp),
    }
  }
}

function GQLLSPosition_to_offset(pos: GQLLSPosition, text: string) {
  return lineColumn(text).toIndex({
    column: pos.character + 1,
    line: pos.line + 1,
  })
}

const defff = 'symbol-interface'
const kind2icon = {
  Field: 'symbol-field',
  OperationDefinition: 'symbol-method',
  Document: 'symbol-file',
  SelectionSet: 'symbol-namespace',
  Name: defff,
  FragmentDefinition: defff,
  FragmentSpread: defff,
  InlineFragment: defff,
  ObjectTypeDefinition: defff,
  InputObjectTypeDefinition: defff,
  InterfaceTypeDefinition: defff,
  EnumTypeDefinition: defff,
  EnumValueDefinition: defff,
  InputValueDefinition: defff,
  FieldDefinition: 'symbol-field',
}

function getTypeInfoAtPosition(
  schema: GraphQLSchema,
  queryText: string,
  cursor: Position,
  contextToken?: ContextToken
) {
  const token = contextToken || getTokenAtPosition(queryText, cursor)

  if (!schema || !token || !token.state) {
    return ''
  }

  const state = token.state
  const kind = state.kind
  const step = state.step
  const typeInfo = getTypeInfo(schema, token.state)
  return typeInfo
}
