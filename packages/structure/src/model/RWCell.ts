import { DiagnosticSeverity } from 'vscode-languageserver-types'

import { lazy } from '../x/decorators'
import { err, Range_fromNode } from '../x/vscode-languageserver-types'

import { RWComponent } from './RWComponent'
import { GraphQLTaggedTemplateLiteral } from './util/GraphQLTaggedTemplateLiteral'

export class RWCell extends RWComponent {
  /**
   * A "Cell" is a component that ends in `Cell.{js, jsx, tsx}`, has no
   * default export AND exports `QUERY`
   **/
  @lazy() get isCell() {
    return !this.hasDefaultExport && this.exportedSymbols.has('QUERY')
  }

  @lazy() get queryStringNode() {
    return this.queryTag?.graphqlStringNode
  }

  @lazy() get queryString(): string | undefined {
    return this.queryTag?.graphqlString
  }

  @lazy() get queryAst() {
    return this.queryTag?.graphqlAST
  }

  @lazy() get queryOperationName(): string | undefined {
    return this.queryTag?.operationName
  }

  /**
   * A Cell can have multiple GraphQL tags
   * the main one is QUERY, but a user can declare as many as they want
   */
  @lazy() get graphqlTags() {
    return Array.from(
      GraphQLTaggedTemplateLiteral.findAllInSourceFile(
        this.sf,
        () => this.parent.graphqlHelper.mergedSchema
      )
    )
  }

  @lazy() get queryTag() {
    return this.graphqlTags.find((t) => t.variableName === 'QUERY')
  }

  *diagnostics() {
    if (!this.exportedSymbols.has('QUERY')) {
      yield err(
        this.uri,
        'Every Cell MUST export a QUERY variable (GraphQL query string)'
      )
    }

    try {
      if (!this.queryOperationName) {
        yield {
          uri: this.uri,
          diagnostic: {
            range: Range_fromNode(this.queryStringNode!),
            message: 'We recommend that you name your query operation',
            severity: DiagnosticSeverity.Warning,
          },
        }
      }
    } catch (e) {
      // Maybe the AST has a syntax error...
      yield {
        uri: this.uri,
        diagnostic: {
          // TODO: point directly to the syntax error.
          range: Range_fromNode(this.sf.getVariableDeclaration('QUERY')!),
          message: e.message,
          severity: DiagnosticSeverity.Error,
        },
      }
    }

    if (!this.exportedSymbols.has('Success')) {
      yield err(
        this.uri,
        'Every Cell MUST export a Success variable (React Component)'
      )
    }
    // TODO: check that exported QUERY is semantically valid GraphQL (fields exist)
  }
  outlineChildren() {
    const tags = this.graphqlTags.map((t) => ({
      outlineLabel: t.variableName,
      outlineChildren: t.graphql_outline,
    }))
    return [
      ...this.getArtifactChildren({ test: true, mock: true, stories: true }),
      ...tags,
    ]
  }

  outlineIcon = 'circuit-board'

  outlineLabel = this.basenameNoExt
}
