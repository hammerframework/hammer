import { getDMMF } from '@prisma/sdk'
import { Command_open } from 'src/x/vscode'
import { FileNode } from '../ide'
import { memo } from '../x/decorators'
import { RWProject } from './RWProject'
import { RWSchemaModel } from './RWSchemaModel'

export class RWSchema extends FileNode {
  constructor(public filePath: string, public parent: RWProject) {
    super()
    if (typeof filePath !== 'string')
      throw new Error('RWSchema( typeof filePath !== "string" )')
  }

  @memo() async dmmf() {
    try {
      return await getDMMF({
        datamodel: this.text,
      })
    } catch (e) {
      // return undefined if dmmf fails to parse
      return undefined
    }
  }

  @memo() async models() {
    return ((await this.dmmf())?.datamodel?.models ?? []).map(
      (m) => new RWSchemaModel(m, this)
    )
  }

  @memo() async modelNames() {
    return (await this.models()).map((m) => m.name)
  }

  @memo() children() {
    return this.models()
  }

  outlineLabel = 'schema.prisma'

  outlineIcon = 'x-prisma'

  outlineMenu = {
    kind: 'withDoc',
    doc: Command_open(
      'https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-schema'
    ),
  }

  outlineCLICommands = [
    {
      cmd: 'db save',
      tooltip: 'save migration file with new changes',
    },
    {
      cmd: 'db up',
      tooltip: 'apply migrations',
    },
  ]

  @memo() outlineChildren() {
    return this.models()
  }
}
