import { DMMF } from '@prisma/generator-helper'
import { BaseNode } from '../ide'
import { lazy, memo } from '../x/decorators'
import { RWSchema } from './RWSchema'
import { RWSchemaModelField } from './RWSchemaModelField'

export class RWSchemaModel extends BaseNode {
  constructor(public model: DMMF.Model, public parent: RWSchema) {
    super()
  }

  @lazy() get id() {
    return this.parent.id + ' ' + this.name
  }

  @lazy() get name() {
    return this.model.name
  }

  @memo() async children() {
    return this.fields
  }

  @lazy() get fields() {
    return this.model.fields.map((f) => new RWSchemaModelField(f, this))
  }

  outlineLabel = this.name

  outlineIcon = 'database'
  // TODO: location for models and fields
  outlineCLICommands = [
    {
      tooltip: 'create graphql interface to access this model',
      cmd: `generate sdl ${this.name}`,
    },
    {
      cmd: `generate scaffold ${this.name}`,
      tooltip: 'generate pages, SDL, and a services object for this model',
    },
  ]
  outlineChildren() {
    return this.fields
  }
}
