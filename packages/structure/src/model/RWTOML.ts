import { Command_open } from 'src/x/vscode'
import { parse as parseTOML } from 'toml'
import { Range } from 'vscode-languageserver-types'

import { FileNode } from '../ide'
import { lazy } from '../x/decorators'
import { err } from '../x/vscode-languageserver-types'

import { RWProject } from './RWProject'

export class RWTOML extends FileNode {
  constructor(public filePath: string, public parent: RWProject) {
    super()
  }
  // @lazy() get content(): TOML.JsonMap {
  //   return TOML.parse(this.text)
  // }
  // TODO: diagnostics
  @lazy() get parsedTOML() {
    return parseTOML(this.text)
  }
  @lazy() get web_includeEnvironmentVariables(): string[] | undefined {
    return this.parsedTOML?.web?.includeEnvironmentVariables ?? []
  }
  *diagnostics() {
    try {
      this.parsedTOML
    } catch (e) {
      const pos = { line: e.line - 1, character: e.column - 1 }
      const range = Range.create(pos, pos)
      // Forward the TOML parse error with correct location information
      yield err({ uri: this.uri, range }, 'TOML Parser Error: ' + e.message)
      return
    }
    // at this point we know that the TOML was parsed successfully
    //this.parsedTOML //?
    //const allowedTopElements = ['web', 'api']
    // TODO: check that schema is correct
  }
  outlineLabel = 'redwood.toml'
  outlineIcon = 'x-redwood'
  outlineMenu = {
    kind: 'withDoc',
    doc: Command_open(
      'https://redwoodjs.com/docs/app-configuration-redwood-toml'
    ),
  }
}
