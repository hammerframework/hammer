import { lazy } from '../x/decorators'
import { FileNode } from '../ide'

import { RWProject } from './RWProject'
/**
 * functions exist in the /functions folder
 */
export class RWFunction extends FileNode {
  constructor(public filePath: string, public parent: RWProject) {
    super()
  }

  @lazy() get isGraphQLFunction() {
    return this.basenameNoExt === 'graphql'
  }

  /**
   * netlify convention ("-background" postfix)
   * ex: somefunc-background.js
   */
  @lazy() get isBackground() {
    return this.basenameNoExt.endsWith('-background')
  }

  outlineChildren() {
    return [...this.getArtifactChildren({ test: true })]
  }

  outlineIcon = 'server-process'

  get outlineDescription() {
    if (this.isGraphQLFunction) return 'main graphql endpoint'
  }

  outlineLabel = this.basenameNoExt
}
