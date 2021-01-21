import { dirname } from 'path'

import * as tsm from 'ts-morph'

import { FileNode } from '../ide'
import { lazy, memo } from '../x/decorators'
import { directoryNameResolver } from '../x/path'

import { RWLayout } from './RWLayout'
import { RWProject } from './RWProject'
import { OutlineInfoProvider } from './types'

export class RWPage extends FileNode implements OutlineInfoProvider {
  constructor(
    public const_: string,
    public path: string,
    public parent: RWProject
  ) {
    super()
  }
  @lazy() get filePath() {
    const f = directoryNameResolver(this.path)
    if (!f)
      throw new Error(
        `could not resolve index filename for directory '${this.path}' using dirname convention`
      )
    return f
  }
  @lazy() get route() {
    return this.parent.router.routes.find(
      (r) => r.page_identifier_str === this.const_
    )
  }
  @lazy() get layoutName(): string | undefined {
    const candidates = this.parent.layouts.map((l) => l.basenameNoExt)
    if (candidates.length === 0) return undefined
    for (const tag of this.sf.getDescendantsOfKind(
      tsm.SyntaxKind.JsxOpeningElement
    )) {
      const t = tag.getTagNameNode().getText() //?
      if (candidates.includes(t)) return t
    }
    return undefined
  }
  @lazy() get actionRemove() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const edits = new Map<any, any>()
    // delete directory (MyPage/...)
    edits.set(dirname(this.filePath), undefined)
    // removing a page also removes its route
    if (this.route) edits.set(this.route.jsxNode, undefined)
    // TODO: we need to transform this edits map to a standard edits map (with locations)
    return edits
  }

  outlineIcon = 'globe'

  @lazy() get outlineLabel() {
    return this.basenameNoExt
  }

  @lazy() get outlineDescription() {
    return this.route?.path
  }

  @lazy() get outlineChildren() {
    return [
      ...this.getArtifactChildren({ test: true }),
      {
        outlineLabel: 'related',
        outlineChildren: () => this.allReferencedNodes(),
      },
    ]
  }

  @lazy() get outlineCLICommands() {
    return [
      {
        cmd: 'rw destroy page ' + this.basenameNoExt,
        tooltip: 'Delete page and related files',
      },
    ]
  }
  @memo() async layout(): Promise<RWLayout | undefined> {
    for (const n of await this.allReferencedNodes())
      if (n instanceof RWLayout) return n
  }
}
