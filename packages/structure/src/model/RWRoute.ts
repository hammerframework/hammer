import * as tsm from 'ts-morph'
import { Location, Range } from 'vscode-languageserver-types'

import { RWError } from '../errors'
import { BaseNode, Decoration, Definition, DocumentLinkX, HoverX } from '../ide'
import { validateRoutePath } from '../util'
import { lazy, memo } from '../x/decorators'
import { Command_cli, Command_open } from '../x/vscode'
import {
  err,
  LocationLike_toLocation,
  Location_fromFilePath,
  Location_fromNode,
  Position_translate,
  Range_fromNode,
} from '../x/vscode-languageserver-types'

import { RWRouter } from './RWRouter'
import { OutlineInfoProvider } from './types'
import { advanced_path_parser } from './util/advanced_path_parser'

export class RWRoute extends BaseNode implements OutlineInfoProvider {
  constructor(
    /**
     * the <Route> tag
     */
    public jsxNode: tsm.JsxSelfClosingElement,
    public parent: RWRouter
  ) {
    super()
  }

  @lazy() get id() {
    // we cannot rely on the "path" attribute of the node
    // it might not be unique (which is an error state, but valid while editing)
    return this.parent.id + ' ' + this.jsxNode.getStart()
  }

  @lazy() get location(): Location {
    return LocationLike_toLocation(this.jsxNode)
  }

  @lazy() get isPrivate() {
    const tagText = this.jsxNode
      .getParentIfKind(tsm.SyntaxKind.JsxElement)
      ?.getOpeningElement()
      ?.getTagNameNode()
      ?.getText()
    return tagText === 'Private'
  }

  @lazy() get hasParameters(): boolean {
    if (!this.path) return false
    // KLUDGE: we need a good path parsing library here
    return this.path.includes('{')
  }

  @lazy() get hasPreRenderInfo() {
    // TODO: this is just a placeholder / reminder
    return false
  }

  @lazy() get outlineLabel(): string {
    if (this.isNotFound) return '404'
    return this.path ?? ''
  }

  @lazy() get outlineDescription(): string | undefined {
    return this.page?.basenameNoExt
  }

  @lazy() get outlineIcon() {
    return this.isPrivate ? 'gist-secret' : 'gist'
  }

  @lazy() get outlineMenu() {
    return {
      kind: 'route',
      openComponent: this.page ? Command_open(this.page.uri) : undefined,
      openRoute: Command_open(this.location),
      openInBrowser: Command_cli(`rw dev --open='${this.path}'`),
    }
  }

  @memo() outlineChildren() {
    // return [
    //   this.page
    //     ? { outlineExtends: this.page, outlineDescription: '' }
    //     : undefined,
    // ]
    return [this.page]
  }

  /**
   * The associated Redwood Page node, if any
   */

  @lazy() get page() {
    if (!this.page_identifier_str) return undefined
    return this.parent.parent.pages.find(
      (p) => p.const_ === this.page_identifier_str
    )
  }
  /**
   * <Route path="" page={THIS_IDENTIFIER}/>
   */
  @lazy() private get page_identifier(): tsm.Identifier | undefined {
    const a = this.jsxNode.getAttribute('page')
    if (!a) return undefined
    if (tsm.Node.isJsxAttribute(a)) {
      const init = a.getInitializer()
      if (tsm.Node.isJsxExpression(init!)) {
        const expr = init.getExpression()
        if (tsm.Node.isIdentifier(expr!)) {
          return expr
        }
      }
    }
    return undefined
  }
  @lazy() get page_identifier_str(): string | undefined {
    return this.page_identifier?.getText()
  }
  @lazy() get name(): string | undefined {
    return this.getStringAttr('name')
  }
  @lazy() get path_errorMessage(): string | undefined {
    // TODO: path validation is not strong enough
    if (typeof this.path === 'undefined') return undefined
    try {
      validateRoutePath(this.path)
      return undefined
    } catch (e) {
      return e.toString()
    }
  }
  @lazy() get path(): string | undefined {
    return this.getStringAttr('path')
  }
  @lazy() get path_literal_node() {
    const a = this.jsxNode.getAttribute('path')
    if (!a) return undefined
    if (tsm.Node.isJsxAttribute(a)) {
      const init = a.getInitializer()
      if (tsm.Node.isStringLiteral(init!)) {
        return init
      }
    }
    return undefined
  }

  @lazy() get isNotFound(): boolean {
    return typeof this.jsxNode.getAttribute('notfound') !== 'undefined'
  }

  *diagnostics() {
    if (this.page_identifier && !this.page)
      // normally this would be caught by TypeScript
      // but Redwood has some "magic" import behavior going on
      yield err(this.page_identifier, 'Page component not found')
    if (this.path_errorMessage && this.path_literal_node)
      yield err(
        this.path_literal_node,
        this.path_errorMessage,
        RWError.INVALID_ROUTE_PATH_SYNTAX
      )
    if (this.hasPathCollision)
      yield err(this.path_literal_node!, 'Duplicate Path')
    if (this.isPrivate && this.isNotFound)
      yield err(
        this.jsxNode!,
        "The 'Not Found' page cannot be within a <Private> tag"
      )
    if (this.isNotFound && this.path)
      yield err(
        this.path_literal_node!,
        "The 'Not Found' page cannot have a path"
      )
    if (this.hasPreRenderInfo && !this.hasParameters)
      yield err(
        this.jsxNode!,
        `Only routes with parameters can have associated pre-render information`
      )
  }
  *ideInfo() {
    // definition: page identifier --> page
    if (this.page && this.page_identifier) {
      yield {
        kind: 'Definition',
        location: Location_fromNode(this.page_identifier),
        target: Location_fromFilePath(this.page.filePath),
      } as Definition
    }
    if (this.path && this.page) {
      // const location = Location_fromNode(this.jsxNode!)
      // yield { kind: 'Hover', location, text: 'Open Preview' }
    }

    yield* this.decorations()

    const { sampleLocalPreviewURL } = this
    if (sampleLocalPreviewURL) {
      const range = Range_fromNode(this.jsxNode)
      yield {
        kind: 'Hover',
        location: { uri: this.parent.uri, range },
        hover: {
          range,
          contents: `[Open Preview](${sampleLocalPreviewURL})`,
        },
      } as HoverX

      const { path_literal_node } = this
      if (path_literal_node) {
        const range = Range_fromNode(this.path_literal_node!)
        yield {
          kind: 'DocumentLink',
          location: { uri: this.parent.uri, range },
          link: {
            range,
            target: sampleLocalPreviewURL,
            tooltip: sampleLocalPreviewURL,
          },
        } as DocumentLinkX
      }
    }
  }

  @lazy() private get hasPathCollision() {
    if (!this.path) return false
    const pathWithNoParamNames = removeParamNames(this.path)
    for (const route2 of this.parent.routes) {
      if (route2 === this) continue
      if (!route2.path) continue
      if (removeParamNames(route2.path) === pathWithNoParamNames) return true
    }
    return false
    function removeParamNames(p: string) {
      // TODO: implement
      // foo/{bar}/baz --> foo/{}/baz
      return p
    }
  }

  private getStringAttr(name: string) {
    const a = this.jsxNode.getAttribute(name)
    if (!a) return undefined
    if (tsm.Node.isJsxAttribute(a)) {
      const init = a.getInitializer()
      if (tsm.Node.isStringLiteral(init!)) return init.getLiteralValue()
    }
    return undefined
  }

  @lazy() get parsedPath() {
    if (!this.path) return undefined
    return advanced_path_parser(this.path)
  }

  private *decorations(): Generator<Decoration> {
    const pp = this.parsedPath
    if (!pp) return
    const uri = this.parent.uri
    const pos = Range_fromNode(this.path_literal_node!).start
    const xxx = {
      path_punctuation: pp.punctuationIndexes,
      path_slash: pp.slashIndexes,
      path_parameter: pp.paramRanges,
      path_parameter_type: pp.paramTypeRanges,
    }
    for (const style of Object.keys(xxx))
      for (const x of xxx[style])
        yield {
          kind: 'Decoration',
          style: style as any,
          location: loc(x),
        }
    function loc(x: number | [number, number]) {
      if (typeof x === 'number') {
        return loc([x, x + 1])
      } else {
        const start = Position_translate(pos, 0, x[0] + 1)
        const end = Position_translate(pos, 0, x[1] + 1)
        return { uri, range: Range.create(start, end) }
      }
    }
  }

  // TODO: we should get the URL of the server dynamically
  @lazy() get sampleLocalPreviewURL(): string | undefined {
    const { path } = this
    if (!path) return undefined
    if (path.includes('{')) return undefined
    return `http://localhost:8910${path}`
  }
}
