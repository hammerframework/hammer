import { DMMF } from '@prisma/generator-helper'
import { BaseNode } from '../ide'
import { lazy } from '../x/decorators'
import { RWSchemaModel } from './RWSchemaModel'

export class RWSchemaModelField extends BaseNode {
  constructor(public field: DMMF.Field, public parent: RWSchemaModel) {
    super()
  }

  @lazy() get id() {
    return this.parent.id + ' ' + this.name
  }

  @lazy() get name() {
    return this.field.name
  }

  @lazy() get outlineLabel() {
    return this.name
  }

  children() {
    return []
  }

  outlineIcon = 'symbol-field'

  @lazy() get outlineDescription() {
    return `${this.field.type}`
  }
}
