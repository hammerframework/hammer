import * as tsm from 'ts-morph'

import { FileNode } from '../ide'
import { iter } from '../x/Array'
import { lazy, memo } from '../x/decorators'
import { basenameNoExt } from '../x/path'

import { RWProject } from './RWProject'
import { RWSDL } from './RWSDL'
import { RWServiceFunction } from './RWServiceFunction'

export class RWService extends FileNode {
  constructor(public filePath: string, public parent: RWProject) {
    super()
  }
  /**
   * The name of this service:
   * services/todos/todos.js --> todos
   */
  @lazy() get name() {
    return basenameNoExt(this.filePath)
  }

  /**
   * Returns the SDL associated with this service (if any).
   * Match is performed by name.
   */

  @lazy() get sdl(): RWSDL | undefined {
    return this.parent.sdls.find((sdl) => sdl.name === this.name)
  }

  children() {
    return [...this.funcs]
  }

  /**
   * All the exported functions declared in this service file.
   * They can be both ArrowFunctions (with name) or FunctionDeclarations (with name)
   */

  @lazy() get funcs() {
    const self = this
    return iter(function* () {
      // export const foo = () => {}
      for (const vd of self.sf.getVariableDeclarations()) {
        if (vd.isExported()) {
          const init = vd.getInitializerIfKind(tsm.SyntaxKind.ArrowFunction)
          if (init) yield new RWServiceFunction(vd.getName(), init, self)
        }
      }
      // export function foo(){}
      for (const fd of self.sf.getFunctions()) {
        if (fd.isExported() && !fd.isDefaultExport()) {
          const nn = fd.getNameNode()
          if (nn) yield new RWServiceFunction(nn.getText(), fd, self)
        }
      }
    })
  }

  outlineIcon = 'server'

  @memo() outlineChildren() {
    return [
      ...this.getArtifactChildren({ test: true }),
      ...this.funcs,
      // {
      //   outlineLabel: 'functions',
      //   outlineChildren: () => this.funcs,
      // },
      {
        outlineLabel: 'related sdl',
        outlineChildren: () => [this.sdl],
      },
    ]
  }

  outlineLabel = this.basenameNoExt
}
