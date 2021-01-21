import * as tsm from 'ts-morph'
import {
  CodeAction,
  CodeLens,
  Command,
  DiagnosticSeverity,
  Position,
  WorkspaceChange,
} from 'vscode-languageserver-types'

import { RWError } from '../errors'
import { CodeLensX, FileNode } from '../ide'
import { iter } from '../x/Array'
import { lazy, memo } from '../x/decorators'
import { URL_file } from '../x/URL'
import { Command_cli, Command_open } from '../x/vscode'
import {
  err,
  ExtendedDiagnostic,
  LocationLike_toLocation,
  Location_fromNode,
} from '../x/vscode-languageserver-types'

import { RWProject } from './RWProject'
import { RWRoute } from './RWRoute'
import { OutlineInfoProvider } from './types'

/**
 * one per Routes.js
 */
export class RWRouter extends FileNode implements OutlineInfoProvider {
  constructor(public filePath: string, public parent: RWProject) {
    super()
    if (typeof filePath !== 'string')
      throw new Error('RWRouter( typeof filePath !== "string" )')
  }
  // this is used by the live preview
  @memo() getFilePathForRoutePath(routePath: string): string | undefined {
    // TODO: params
    return this.routes.find((r) => r.path === routePath)?.page?.filePath
  }
  // this is used by the live preview
  @memo() getRoutePathForFilePath(filePath: string): string | undefined {
    // TODO: params
    const path = this.parent.pages.find((p) => p.filePath === filePath)?.route
      ?.path
    if (path?.includes('{')) return
    return path
  }

  /**
   * the <Router> tag
   */

  @lazy() private get jsxNode() {
    return this.sf
      .getDescendantsOfKind(tsm.SyntaxKind.JsxOpeningElement)
      .find((x) => x.getTagNameNode().getText() === 'Router')
  }

  /**
   * One per <Route>
   */

  @lazy() get routes() {
    const self = this
    return iter(function* () {
      if (!self.jsxNode) return
      // TODO: make sure that they are nested within the <Router> tag
      // we are not checking it right now
      for (const x of self.sf.getDescendantsOfKind(
        tsm.SyntaxKind.JsxSelfClosingElement
      )) {
        const tagName = x.getTagNameNode().getText()
        if (tagName === 'Route') yield new RWRoute(x, self)
      }
    })
  }
  @lazy() private get numNotFoundPages(): number {
    return this.routes.filter((r) => r.isNotFound).length
  }
  *ideInfo() {
    if (this.jsxNode) {
      let location = Location_fromNode(this.jsxNode)
      const codeLens: CodeLens = {
        range: location.range,
        command: Command.create(
          'Create Page...',
          'redwoodjs.cli',
          'generate page...',
          this.parent.projectRoot
        ),
      }
      yield {
        kind: 'CodeLens',
        location,
        codeLens,
      } as CodeLensX
    }
  }

  @lazy() get quickFix_addNotFoundpage() {
    if (!this.jsxNode) return undefined
    const change = new WorkspaceChange({ documentChanges: [] })
    let uri = URL_file(this.parent.defaultNotFoundPageFilePath)
    const p = this.parent.pages.find((p) => p.basenameNoExt === 'NotFoundPage')
    if (p) {
      uri = p.uri
      // page already exists, we just need to add the <Route/>
    } else {
      change.createFile(uri)
      change
        .getTextEditChange({ uri, version: null })
        .insert(
          Position.create(0, 0),
          `export default () => <div>Not Found</div>`
        )
    }
    // add <Route/>
    const loc = LocationLike_toLocation(this.jsxNode)
    const lastRoute = this.routes[this.routes.length - 1]
    const lastRouteLoc = LocationLike_toLocation(lastRoute.jsxNode)
    const textEditChange = change.getTextEditChange({
      uri: loc.uri,
      version: null,
    })
    const indent = ' '.repeat(lastRouteLoc.range.start.character)
    textEditChange.insert(
      lastRouteLoc.range.end,
      `\n${indent}<Route notfound page={NotFoundPage}/>\n`
    )
    return {
      title: 'Create default Not Found Page',
      edit: change.edit,
    } as CodeAction
  }

  *diagnostics() {
    if (!this.fileExists) {
      // should we assign this error to the project? to redwood.toml?
      const uri = URL_file(this.parent.projectRoot, 'redwood.toml')
      const message = `Routes.js does not exist`
      yield err(uri, message)
      // TODO: add quickFix (create a simple Routes.js)
      return // stop checking for errors if the file doesn't exist
    }

    if (!this.jsxNode) return

    if (this.numNotFoundPages === 0) {
      const { uri, range } = LocationLike_toLocation(this.jsxNode)
      yield {
        uri,
        diagnostic: {
          range,
          message: "You must specify a 'notfound' page",
          severity: DiagnosticSeverity.Error,
        },
        quickFix: async () => this.quickFix_addNotFoundpage,
      } as ExtendedDiagnostic
    } else if (this.numNotFoundPages > 1) {
      const e = err(
        this.jsxNode,
        "You must specify exactly one 'notfound' page",
        RWError.NOTFOUND_PAGE_NOT_DEFINED
      )
      yield e
    }
  }
  async children() {
    return [...this.routes]
  }
  outlineLabel = 'web / routes'
  outlineIcon = 'globe'
  outlineChildren = () => this.routes
  outlineMenu = {
    kind: 'group',
    add: Command_cli('rw generate page ...'),
    doc: Command_open('https://redwoodjs.com/docs/redwood-router'),
  }
}
