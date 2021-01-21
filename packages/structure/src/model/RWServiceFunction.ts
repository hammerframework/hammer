import * as tsm from 'ts-morph'
import { DiagnosticSeverity } from 'vscode-languageserver-types'

import { BaseNode, Reference } from '../ide'
import { iter } from '../x/Array'
import { lazy, memo } from '../x/decorators'
import {
  ExtendedDiagnostic,
  Location_fromNode,
} from '../x/vscode-languageserver-types'

import { RWSDLField } from './RWSDLField'
import { RWService } from './RWService'
import { OutlineInfoProvider } from './types'

export class RWServiceFunction extends BaseNode implements OutlineInfoProvider {
  constructor(
    public name: string,
    public node: tsm.FunctionDeclaration | tsm.ArrowFunction,
    public parent: RWService
  ) {
    super()
  }

  @lazy() get id() {
    // This is a compound ID (because it points to an internal node - one within a file)
    return this.parent.id + ' ' + this.name
  }

  bailOutOnCollection(uri: string): boolean {
    if (this.parent.uri === uri) return false
    return true
  }

  @lazy() get functionNameNode() {
    // this is straightforward if this is a function declaration
    if (tsm.Node.isFunctionDeclaration(this.node))
      return this.node.getNameNode()
    // but if this is an arrow function, then we need to jump out to get the variable name
    return this.node
      .getFirstAncestorByKind(tsm.SyntaxKind.VariableDeclaration)
      ?.getNameNode()
  }

  /**
   * The SDL field that this function implements, if any
   * TODO: describe this in prose.
   */
  @lazy() get sdlField(): RWSDLField | undefined {
    return this.parent.sdl?.implementableFields?.find(
      (f) => f.name === this.name
    )
  }

  @lazy() get parameterNames() {
    const self = this
    return iter(function* () {
      for (const p of self.node.getParameters()) {
        const nn = p.getNameNode()
        if (nn instanceof tsm.ObjectBindingPattern) {
          for (const element of nn.getElements()) {
            yield element.getNameNode().getText()
          }
        }
        // TODO: handle other cases
      }
    })
  }

  *diagnostics() {
    if (this.sdlField) {
      // this service function is implementing a field
      // parameter names should match
      const p1 = this.sdlField.argumentNames.sort().join(' ') //?
      const p2 = this.parameterNames.sort().join(' ') //?
      if (p1 !== p2) {
        const locationNode = this.node.getParameters()[0] ?? this.node
        const { uri, range } = Location_fromNode(locationNode)
        const message = `Parameter mismatch between SDL and implementation ("${p1}" !== "${p2}")`
        const diagnostic = {
          uri,
          diagnostic: {
            range,
            message,
            severity: DiagnosticSeverity.Error,
            // add related information so developers can jump to the SDL definition
            relatedInformation: [
              {
                location: this.sdlField.location,
                message: 'SDL field is defined here',
              },
            ],
          },
        } as ExtendedDiagnostic
        // comment out for now (see https://github.com/redwoodjs/redwood/issues/943)
        if (false) yield diagnostic // eslint-disable-line
      }

      // TODO: check that types match
      // to do this it is probably easier to leverage a graphql code generator and the typescript compiler
      // the trick is to create a source file with an interface assignment that will fail if there is a mismatch
      // we then simpy "bubble up" the type errors from the typescript compiler
    }
  }

  *ideInfo() {
    if (this.sdlField?.location) {
      if (this.functionNameNode) {
        const location = Location_fromNode(this.functionNameNode)
        const target = this.sdlField.name_location
        yield {
          kind: 'Reference',
          location,
          target,
        } as Reference
      }
    }
  }

  @lazy() get location() {
    return Location_fromNode(this.node)
  }

  @lazy() get outlineLabel() {
    return this.name
  }

  @lazy() get outlineLocation() {
    if (this.functionNameNode) return Location_fromNode(this.functionNameNode)
  }

  @memo() outlineChildren() {
    return [
      {
        outlineLabel: 'implements GraphQL/SDL field',
        outlineChildren: () => [this.sdlField],
      },
    ]
  }

  outlineIcon = 'symbol-method'
}
