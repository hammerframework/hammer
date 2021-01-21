import { join } from 'path'

import * as dotenv from 'dotenv-defaults'
import { existsSync, readFileSync } from 'fs-extra'
import { pickBy } from 'lodash'
import * as tsm from 'ts-morph'
import { DiagnosticSeverity, Location, Range } from 'vscode-languageserver'

import {
  ExtendedDiagnostic,
  ExtendedDiagnostic_is,
  LocationLike_toHashLink,
  LocationLike_toLocation,
} from 'src/x/vscode-languageserver-types'

import { BaseNode, CodeLensX, Definition, HoverX, Reference } from '../ide'
import { lazy } from '../x/decorators'
import { prisma_parseEnvExpressionsInFile } from '../x/prisma'
import { URL_file } from '../x/URL'
import { Command_open } from '../x/vscode'

import { RWProject } from './RWProject'
import { process_env_findAll } from './util/process_env'

type EnvVarMap = Record<string, string>

export class RWEnvHelper extends BaseNode {
  constructor(public parent: RWProject) {
    super()
  }

  @lazy() get id() {
    // this is an internal node. it is not associated to any particular file
    return this.parent.id + ' envHelper'
  }

  bailOutOnCollection() {
    // we need this node to participate in all collection requests
    // because it will emit info and diagnostics for files all over the codebase
    return false
  }

  /**
   * parse .env
   * return undefined if not present
   * NOTE: It does not apply defaults (see env_merged)
   */
  @lazy() get env(): EnvVarMap | undefined {
    return this._dotenv('.env')
  }

  /**
   * .env.defaults
   * return undefined if not present
   */
  @lazy() get env_defaults(): EnvVarMap | undefined {
    return this._dotenv('.env.defaults')
  }

  @lazy() get api_pisma_env() {
    return this._dotenv('api/prisma/.env')
  }

  /**
   * .env.defaults + .env
   * uses the same algorithm that env-defaults does (Object.assign(), which is equivalent to object spread addition)
   */
  @lazy() get env_default_merged(): EnvVarMap {
    return { ...(this.env_defaults ?? {}), ...(this.env ?? {}) }
  }

  /**
   * - starts with .env + .env.defaults
   * - allows any variables prefixed with 'REDWOOD_ENV_'
   * - applies the "include" rule on the rest
   * @param include
   */
  private env_default_merged_filtered(include: string[]): EnvVarMap {
    return pickBy(
      this.env_default_merged,
      (_v, k) => k.startsWith('REDWOOD_ENV_') || include?.includes(k)
    )
  }

  private _dotenv(f: string) {
    const file = join(this.parent.projectRoot, f)
    if (!existsSync(file)) return undefined
    return dotenv.parse(readFileSync(file))
  }

  @lazy() get env_available_to_api() {
    // in the API side, all variables are visible
    return this.env_default_merged
    // return this.env_merged_filter(
    //   this.parent.redwoodTOML.api_includeEnvironmentVariables ?? []
    // )
  }

  @lazy() get env_available_to_web() {
    return this.env_default_merged_filtered(
      this.parent.redwoodTOML.web_includeEnvironmentVariables ?? []
    )
  }

  children() {
    return [...this.process_env_expressions]
  }

  @lazy() get process_env_expressions() {
    // TODO: make this async (this is globbing around quite a bit)
    const { pathHelper } = this.parent
    const api = process_env_findAll(pathHelper.api.base).map(
      (x) => new ProcessDotEnvExpression(this, 'api', x.key, x.node)
    )
    const web = process_env_findAll(pathHelper.web.base).map(
      (x) => new ProcessDotEnvExpression(this, 'web', x.key, x.node)
    )
    const prisma = Array.from(
      prisma_parseEnvExpressionsInFile(pathHelper.api.dbSchema)
    )
    const pp = prisma.map(
      (x) => new ProcessDotEnvExpression(this, 'prisma', x.key, x.location)
    )
    return [...api, ...web, ...pp]
  }
}

/**
 * An occurence of process.env somewhere in the codebase
 */
class ProcessDotEnvExpression extends BaseNode {
  constructor(
    public parent: RWEnvHelper,
    public kind: 'api' | 'web' | 'prisma',
    public key: string,
    public node: tsm.Node | Location
  ) {
    super()
  }

  bailOutOnCollection(uri: string) {
    if (this.location.uri !== uri) return true
    return false
  }

  @lazy() get id() {
    // this is an internal node. it is not associated to any particular file
    // we just need to make sure the ID is unique and correctly nested
    return this.parent.id + ' ' + LocationLike_toHashLink(this.location)
  }

  @lazy() get side() {
    return this.kind === 'web' ? 'web' : 'api'
  }

  @lazy() get location() {
    return LocationLike_toLocation(this.node)
  }

  *ideInfo() {
    for (const x of this.render()) if (!ExtendedDiagnostic_is(x)) yield x
  }

  *diagnostics() {
    for (const x of this.render()) if (ExtendedDiagnostic_is(x)) yield x
  }

  @lazy() get value_definition_file_basename() {
    const {
      key,
      parent: { env, env_defaults },
    } = this
    if (env?.[key]) return '.env'
    if (env_defaults?.[key]) return '.env.defaults'
    return undefined
  }

  @lazy() get value_definition_location(): Location | undefined {
    const x = this.value_definition_file_basename
    if (!x) return undefined
    const file = join(this.parent.parent.projectRoot, x)
    const content = readFileSync(file).toString()
    const lines = content.split('\n')
    const index = lines.findIndex((l) => l.startsWith(this.key + '='))
    return {
      uri: URL_file(file),
      range: Range.create(index, 0, index, lines[index].length),
    }
  }

  @lazy() get value_as_available() {
    if (this.side === 'web') return this.parent.env_available_to_web[this.key]
    const v = this.parent.env_available_to_api[this.key]
    return v
  }

  private *render() {
    const { key, location, value_as_available } = this
    const { uri, range } = location

    // show reference to value definition
    if (this.value_definition_location) {
      yield {
        kind: 'Reference',
        location,
        target: this.value_definition_location,
      } as Reference
      yield {
        kind: 'Definition',
        location,
        target: this.value_definition_location,
      } as Definition
    }
    // show hover with the actual value, if present
    if (typeof value_as_available !== 'undefined') {
      yield {
        kind: 'Hover',
        location,
        hover: {
          range: location.range,
          contents: `${key}=${value_as_available} (${
            this.value_definition_file_basename ?? ''
          })`,
        },
      } as HoverX

      if (
        typeof value_as_available !== 'undefined' &&
        this.value_definition_location
      ) {
        const title = `${key}=${value_as_available}`
        const command = {
          ...Command_open(this.value_definition_location),
          title,
        }
        const codelens = {
          kind: 'CodeLens',
          location,
          codeLens: {
            range,

            command,
          },
        } as CodeLensX
        // TODO: we need to add middleware to the LSP client
        // so the uri (string) is converted to a vscode.Uri
        // https://github.com/microsoft/vscode-languageserver-node/issues/495
        // eslint-disable-next-line no-constant-condition
        if (false) yield codelens
      }
    }

    if (typeof value_as_available === 'undefined') {
      // the value is not available
      // there are a few scenarios here...
      if (this.parent.env_default_merged[key]) {
        // value is actually in the merged env, but it is not visible here
        // this is probably because the user forgot to add an includeEnvironmentVariables rule
        const snippet = `
[${this.side}]
  includeEnvironmentVariables = ['${this.key}']`
        yield {
          uri,
          diagnostic: {
            range,
            message: `
This env variable is present in '${this.value_definition_file_basename}',
but it won't be available to your app in production *unless* you add it to includeEnvironmentVariables.
Tip: add the following to your redwood.toml:
${snippet}
            `,
            severity: DiagnosticSeverity.Warning,
            // TODO: quickFix
          },
        } as ExtendedDiagnostic
      } else {
        // the value is simply not visible
        yield {
          uri,
          diagnostic: {
            range,
            message: `env value ${key} is not available. add it to your .env file`,
            severity: DiagnosticSeverity.Warning,
            // TODO: add a quickfix?
          },
        } as ExtendedDiagnostic
      }
    }
  }
}
