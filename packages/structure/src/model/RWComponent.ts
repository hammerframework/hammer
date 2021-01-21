import * as tsm from 'ts-morph'

import { FileNode } from '../ide'
import { lazy } from '../x/decorators'

import { RWProject } from './RWProject'
import { OutlineInfoProvider } from './types'

export class RWComponent extends FileNode implements OutlineInfoProvider {
  constructor(public filePath: string, public parent: RWProject) {
    super()
  }

  get isCell() {
    return false
  }

  @lazy() get hasDefaultExport(): boolean {
    // TODO: Is this enough to test a default export?
    return (
      this.sf.getDescendantsOfKind(tsm.SyntaxKind.ExportAssignment).length > 0
    )
  }

  @lazy() get stories() {
    // TODO: this is a placeholder
    // we could list all the (storybook) stories related to this component here
    return []
  }

  @lazy() get exportedSymbols() {
    // KLUDGE!
    const ss = new Set<string>()
    for (const d of this.sf.getDescendantsOfKind(
      tsm.SyntaxKind.VariableDeclaration
    ))
      if (d.isExported()) ss.add(d.getName())
    return ss
  }

  outlineChildren() {
    return [...this.getArtifactChildren({ stories: true, test: true })]
  }

  outlineIcon = 'extensions'

  outlineLabel = this.basenameNoExt
}
