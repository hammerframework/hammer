import { join } from 'path'

import { existsSync } from 'fs-extra'
import { partition } from 'lodash'
import * as tsm from 'ts-morph'

import { getPaths, processPagesDir } from '@redwoodjs/internal/dist/paths'

import { Host } from '../hosts'
import { BaseNode } from '../ide'
import { lazy, memo } from '../x/decorators'
import {
  followsDirNameConvention,
  isCellFileName,
  isLayoutFileName,
  isNotArtifact,
} from '../x/path'
import { tsm_Project_redwoodFriendly } from '../x/ts-morph2/tsm_Project_redwoodFriendly'
import { ts_findTSOrJSConfig } from '../x/ts/ts_findTSConfig'
import { URL_file } from '../x/URL'
import { Command_cli, Command_open } from '../x/vscode'

import { RWCell } from './RWCell'
import { RWComponent } from './RWComponent'
import { RWEnvHelper } from './RWEnvHelper'
import { RWFunction } from './RWFunction'
import { RWGraphQLHelper } from './RWGraphQLHelper'
import { RWLayout } from './RWLayout'
import { RWPage } from './RWPage'
import { RWRouter } from './RWRouter'
import { RWSchema } from './RWSchema'
import { RWSDL } from './RWSDL'
import { RWService } from './RWService'
import { RWTOML } from './RWTOML'
import { OutlineInfoProvider } from './types'

export interface RWProjectOptions {
  projectRoot: string
  host: Host
}

const allFilesGlob = '/**/*.{js,jsx,ts,tsx}'

/**
 * Represents a Redwood project.
 * This is the root node.
 */
export class RWProject extends BaseNode implements OutlineInfoProvider {
  constructor(public opts: RWProjectOptions) {
    super()
  }
  parent = undefined

  get host() {
    return this.opts.host
  }

  get projectRoot() {
    return this.opts.projectRoot
  }

  @lazy() get id() {
    return URL_file(this.projectRoot)
  }

  children() {
    return [
      this.redwoodTOML,
      ...this.pages,
      this.router,
      ...this.services,
      ...this.sdls,
      ...this.layouts,
      ...this.components,
      // ...this.cells <-- this is not necessary. cells are included in this.components
      this.envHelper,
      this.graphqlHelper,
      this.schema,
    ]
  }

  /**
   * Path constants that are relevant to a Redwood project.
   */
  @lazy() get pathHelper() {
    return getPaths(this.projectRoot)
  }
  /**
   * Checks for the presence of a tsconfig.json at the root.
   * TODO: look for this file at the root? or within each side? (api/web)
   */
  @lazy() get isTypeScriptProject(): boolean {
    return this.host.existsSync(join(this.projectRoot, 'tsconfig.json'))
  }

  @lazy() get schema(): RWSchema | undefined {
    const x = this.pathHelper.api.dbSchema
    if (!existsSync(x)) return undefined
    return new RWSchema(x, this)
  }

  // TODO: do we move this to a separate node? (ex: RWDatabase)
  @memo() async prismaDMMF() {
    return await this.schema?.dmmf()
  }
  @memo() async prismaDMMFModelNames() {
    return (await this.schema?.modelNames()) ?? []
  }
  @lazy() get redwoodTOML(): RWTOML {
    return new RWTOML(join(this.projectRoot, 'redwood.toml'), this)
  }
  @lazy() private get processPagesDir() {
    try {
      return processPagesDir(this.pathHelper.web.pages)
    } catch (e) {
      return []
    }
  }
  @lazy() get pages(): RWPage[] {
    return this.processPagesDir.map((p) => new RWPage(p.const, p.path, this))
  }
  @lazy() get router() {
    return this.getRouter()
  }
  getRouter = () => {
    return new RWRouter(this.pathHelper.web.routes, this)
  }

  // TODO: move to path helper
  servicesFilePath(name: string) {
    // name = blog,posts
    const ext = this.isTypeScriptProject ? '.ts' : '.js'
    return join(this.pathHelper.api.services, name, name + ext)
  }

  // TODO: move to path helper
  @lazy() get defaultNotFoundPageFilePath() {
    const ext = this.isTypeScriptProject ? '.tsx' : '.js' // or jsx?
    return join(this.pathHelper.web.pages, 'NotFoundPage', 'NotFoundPage' + ext)
  }

  @lazy() get services() {
    // TODO: what is the official logic?
    // TODO: Support both `/services/todos/todos.js` AND `/services/todos.js`
    return this.host
      .globSync(this.pathHelper.api.services + allFilesGlob)
      .filter(followsDirNameConvention)
      .filter(isNotArtifact)
      .map((x) => new RWService(x, this))
  }

  @lazy() get sdls() {
    return this.host
      .globSync(this.pathHelper.api.graphql + '/**/*.sdl.{js,ts}')
      .filter(isNotArtifact)
      .map((x) => new RWSDL(x, this))
  }

  @lazy() get layouts(): RWLayout[] {
    // TODO: what is the official logic?
    return this.host
      .globSync(this.pathHelper.web.layouts + allFilesGlob)
      .filter(followsDirNameConvention)
      .filter(isLayoutFileName)
      .filter(isNotArtifact)
      .map((x) => new RWLayout(x, this))
  }

  @lazy() get functions(): RWFunction[] {
    // TODO: what is the official logic?
    return this.host
      .globSync(this.pathHelper.api.functions + allFilesGlob)
      .filter(isNotArtifact)
      .map((x) => new RWFunction(x, this))
  }

  /**
   * all components (including cells, which are a subclass of component)
   */
  @lazy() get components(): RWComponent[] {
    return this.host
      .globSync(this.pathHelper.web.components + allFilesGlob)
      .filter(followsDirNameConvention)
      .filter(isNotArtifact)
      .map((file) => {
        if (isCellFileName(file)) {
          const possibleCell = new RWCell(file, this)
          return possibleCell.isCell
            ? possibleCell
            : new RWComponent(file, this)
        }
        return new RWComponent(file, this)
      })
  }

  @lazy() get sides() {
    return ['web', 'api']
  }

  // TODO: Wrap these in a real model.
  @lazy() get mocks() {
    return this.host.globSync(this.pathHelper.web.base + '/**/*.mock.{js,ts}')
  }

  /**
   * A "Cell" is a component that ends in `Cell.{js, jsx, tsx}`, but does not
   * have a default export and exports `QUERY`
   **/
  @lazy() get cells(): RWCell[] {
    return this.components.filter((c) => c.isCell) as RWCell[]
  }

  @lazy() get envHelper(): RWEnvHelper {
    return new RWEnvHelper(this)
  }

  @lazy() get graphqlHelper(): RWGraphQLHelper {
    return new RWGraphQLHelper(this)
  }

  /**
   * Returns an initalized ts-morph project that contains a given file.
   * Delegates to tsm_Project_forTSConfig()
   * @param filePath
   */
  @memo() tsm_Project_forFile(filePath: string): tsm.Project | undefined {
    const x = ts_findTSOrJSConfig(filePath)
    if (!x) return undefined
    return this.tsm_Project_forTSConfig(x)
  }

  /**
   * Returns a fully configured TSMorph project for a given TSConfig.
   * This is used to get fully configured web-side and api-side projects.
   *
   * Memoizing this function is important since creating a ts-morph project is expensive
   * @param tsConfigFilePath
   */
  @memo() tsm_Project_forTSConfig(tsConfigFilePath: string) {
    return tsm_Project_redwoodFriendly(tsConfigFilePath)
  }

  @memo() outlineChildren() {
    return [
      this.router,
      grp(
        'web / pages',
        undefined,
        'react components implementing complete pages',
        'globe',
        () => this.pages,
        'rw generate page ...',
        'https://redwoodjs.com/tutorial/our-first-page'
      ),
      grp(
        'web / layouts',
        undefined,
        'react components implementing layouts',
        'preview',
        () => this.layouts,
        'rw generate layout ...',
        'https://redwoodjs.com/tutorial/layouts'
      ),
      grp(
        'web / components',
        undefined,
        'react components implementing smaller ui parts',
        'extensions',
        () => this.components.filter((c) => !c.isCell),
        'rw generate component ...',
        'https://redwoodjs.com/docs/cli-commands.html#component'
      ),
      grp(
        'web / cells',
        'data-driven react components',
        'data-driven react components that connect the web side (ui) to the api side (via GraphQL queries)',
        'circuit-board',
        () => this.cells,
        'rw generate cell ...',
        'https://redwoodjs.com/tutorial/cells'
      ),
      grp(
        'api / sdls',
        'api definition (graphql)',
        'api definition (graphql)',
        'circuit-board',
        () => this.sdls,
        'rw generate sdl ...',
        'https://redwoodjs.com/tutorial/getting-dynamic'
      ),
      grp(
        'api / services',
        'api implementation (resolvers)',
        'api implementation (resolvers)',
        'server',
        () => this.services,
        'rw generate service ...',
        'https://redwoodjs.com/docs/cli-commands.html#service'
      ),
      grp(
        'api / functions',
        'serverless functions',
        'serverless functions',
        'server-process',
        () => {
          const [backgroundFunctions, functions] = partition(
            this.functions,
            (f) => f.isBackground
          )
          return [
            ...functions,
            {
              outlineLabel: 'background functions',
              outlineChildren: backgroundFunctions,
            },
          ]
        },
        'rw generate function ...',
        'https://redwoodjs.com/docs/serverless-functions'
      ),
      this.schema,
      this.redwoodTOML,
    ]
  }

  outlineCLICommands = [
    {
      cmd: 'generate ...',
      tooltip: 'start interactive redwood generator',
    },
    {
      cmd: 'dev',
      tooltip: 'start development server and open browser',
    },
  ]

  static forNode(node: BaseNode): RWProject | undefined {
    return node instanceof RWProject
      ? node
      : node.parent
      ? this.forNode(node.parent)
      : undefined
  }
}

function grp(
  outlineLabel: string,
  outlineDescription: string | undefined,
  outlineTooltip: string | undefined,
  outlineIcon: string,
  outlineChildren: any,
  addCmd: string,
  doc: string
) {
  return {
    outlineLabel,
    outlineDescription,
    outlineIcon,
    outlineChildren,
    outlineTooltip,
    outlineMenu: {
      kind: 'group',
      add: Command_cli(addCmd),
      doc: Command_open(doc),
    },
  } as OutlineInfoProvider
}
