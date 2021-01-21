import { FileNode } from '../ide'
import { memo } from '../x/decorators'

import { RWPage } from './RWPage'
import { RWProject } from './RWProject'
import { OutlineInfoProvider } from './types'

/**
 * layouts live in the src/layouts folder
 */
export class RWLayout extends FileNode implements OutlineInfoProvider {
  constructor(public filePath: string, public parent: RWProject) {
    super()
  }
  outlineIcon = 'preview'
  @memo() async pagesUsingThisLayout() {
    const res: RWPage[] = []
    Promise.all(
      this.parent.pages.map(async (p) => {
        if ((await p.layout()) === this) res.push(p)
      })
    )
    return res
  }

  @memo() outlineChildren() {
    return [
      {
        outlineLabel: 'pages using this layout',
        outlineChildren: () => this.pagesUsingThisLayout(),
      } as OutlineInfoProvider,
      ...this.getArtifactChildren(),
    ]
  }

  outlineLabel = this.basenameNoExt
}
