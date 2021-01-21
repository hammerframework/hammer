import { Location as GraphQLLocation } from 'graphql'
import {
  FieldDefinitionNode,
  ObjectTypeDefinitionNode,
} from 'graphql/language/ast'
import {
  CodeAction,
  DiagnosticSeverity,
  Location,
  Position,
  WorkspaceChange,
} from 'vscode-languageserver-types'

import { RWError } from '../errors'
import { BaseNode, Implementation, Reference } from '../ide'
import { lazy } from '../x/decorators'
import { URL_file } from '../x/URL'
import {
  ExtendedDiagnostic,
  Location_fromNode,
} from '../x/vscode-languageserver-types'

import { RWSDL } from './RWSDL'
import { RWServiceFunction } from './RWServiceFunction'

export class RWSDLField extends BaseNode {
  constructor(
    public objectTypeDef: ObjectTypeDefinitionNode,
    public field: FieldDefinitionNode,
    public parent: RWSDL
  ) {
    super()
  }
  @lazy() get id() {
    return (
      this.parent.id + ' ' + this.objectTypeDef.name.value + '.' + this.name
    )
  }
  bailOutOnCollection(uri: string): boolean {
    if (this.parent.uri === uri) return false
    return true
  }
  /**
   * The location of this field.
   * Calculating this is slightly complicated since it is embedded within a TaggedTemplateLiteral
   */
  @lazy() get location(): Location {
    return this._loc_map_orFail(this.field.loc)
  }

  /**
   * only the location of the "name" part of this field declaration
   */
  @lazy() get name_location(): Location {
    return this._loc_map_orFail(this.field.name.loc)
  }
  private _loc_map_orFail(loc?: GraphQLLocation) {
    if (loc) {
      const loc2 = this.parent.schemaTag?.loc__gql_to_lsp(loc)
      if (loc2) return loc2
    }
    throw new Error('cannot map graphql location to LSP location') // this should not happen
  }

  @lazy() get name() {
    return this.field.name.value
  }
  @lazy() get argumentNames() {
    return (this.field.arguments ?? []).map((a) => a.name.value)
  }
  *ideInfo() {
    if (this.impl) {
      const location = this.location
      const target = Location_fromNode(
        this.impl.functionNameNode ?? this.impl.node
      )
      yield {
        kind: 'Implementation',
        location,
        target,
      } as Implementation
      yield {
        kind: 'Reference',
        location,
        target,
      } as Reference
      // TODO: see https://github.com/microsoft/vscode-languageserver-node/issues/555
      // yield {
      //   kind: 'CodeLens',
      //   location,
      //   codeLens: {
      //     range: location.range,
      //     command: Command_open(target, 'Open Implementation (Service)'),
      //   },
      // } as CodeLensX
      // yield {
      //   kind: 'CodeLens',
      //   location,
      //   codeLens: {
      //     range: location.range,
      //     command: {
      //       command: 'editor.action.showReferences',
      //       title: 'show references',
      //     },
      //   },
      // } as CodeLensX
      // editor.action.showReference
    }
  }
  /**
   * TODO: describe in prose what is going on here.
   * this is an important rule
   */
  @lazy() get impl(): RWServiceFunction | undefined {
    return this.parent.service?.funcs?.find((f) => f.name === this.name)
  }
  // TODO: improve snippet
  @lazy() private get defaultImplSnippet(): string {
    const args = this.field.arguments ?? []
    const params = args.map((a) => a.name.value).join(',')
    return `
export const ${this.field.name.value} = ({${params}}) => {
  // TODO: implement
}`
  }

  @lazy() get quickFix_addImplementation(): CodeAction {
    const { service } = this.parent
    const change = new WorkspaceChange({ documentChanges: [] })
    let insertPosition = Position.create(0, 0)
    let uri = URL_file(this.parent.serviceFilePath)
    if (service) {
      // we'll insert into the end of an existing file
      const lastLine = service.sf.getEndLineNumber()
      insertPosition = Position.create(lastLine, 0)
      uri = service.uri
    } else {
      // file doesn't exist
      // create the service file before inserting
      change.createFile(uri)
    }
    // insert
    change
      .getTextEditChange({ uri, version: null })
      .insert(insertPosition, this.defaultImplSnippet)
    return {
      title: 'Add implementation',
      edit: change.edit,
    } as CodeAction
  }

  *diagnostics() {
    if (!this.impl) {
      const { uri, range } = this.location
      yield {
        uri,
        diagnostic: {
          range,
          message: 'Service Not Implemented',
          severity: DiagnosticSeverity.Error,
          code: RWError.SERVICE_NOT_IMPLEMENTED,
        },
        quickFix: async () => this.quickFix_addImplementation,
      } as ExtendedDiagnostic
    }
  }

  @lazy() get outlineLabel() {
    return this.name
  }

  outlineIcon = 'symbol-method'
}
