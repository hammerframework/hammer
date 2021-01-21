import { readdirSync } from 'fs-extra'
import { partition } from 'lodash'
import { dirname, join } from 'path'
import { RWServiceFunction } from 'src/model/RWServiceFunction'
import { followsDirNameConvention } from 'src/x/path'
import { DocumentUri } from 'vscode-languageserver'
import { BaseNode, FileNode } from '../ide'
import { RWCell, RWPage, RWProject, RWRoute, RWService } from '../model'
import { URL_file, URL_toFile } from '../x/URL'
import { Command_cli, Command_open, TreeItem2 } from '../x/vscode'

export function getOutline(project: RWProject): TreeItem2 {
  return {
    children: () => [
      _router(project),
      _pages(project),
      _components(project),
      _layouts(project),
      _cells(project),
      _services(project),
      _functions(project),
      _schema(project),
      {
        label: 'redwood.toml',
        iconPath: 'x-redwood',
        ...resourceUriAndCommandFor(
          URL_file(project.pathHelper.base, 'redwood.toml')
        ),
        menu: {
          kind: 'withDoc',
          doc: Command_open(
            'https://redwoodjs.com/docs/app-configuration-redwood-toml'
          ),
        },
      } as TreeItem2,
      {
        label: 'open graphql playground',
        command: Command_open('http://localhost:8911/graphql'),
        iconPath: 'x-graphql',
        menu: {
          kind: 'withDoc',
          doc: Command_open(
            'https://www.apollographql.com/docs/apollo-server/testing/graphql-playground/'
          ),
        },
      } as TreeItem2,
      {
        label: 'open storybook',
        command: Command_cli('rw storybook --open'),
        iconPath: 'x-storybook',
        menu: {
          kind: 'withDoc',
          doc: Command_open(
            'https://redwoodjs.com/cookbook/mocking-graph-ql-in-storybook'
          ),
        },
      } as TreeItem2,
      _rwcli_command_group(
        {
          cmd: 'generate ...',
          tooltip: 'start interactive redwood generator',
        },
        {
          cmd: 'dev',
          tooltip: 'start development server and open browser',
        }
      ),
    ],
  }
}

function _router(project: RWProject): TreeItem2 {
  const { router } = project
  return {
    label: 'routes',
    ...resourceUriAndCommandFor(router.uri),
    iconPath: 'globe',
    children: () => router.routes.map(_router_route),
    menu: {
      kind: 'group',
      add: Command_cli('rw generate page ...'),
      doc: Command_open('https://redwoodjs.com/docs/redwood-router'),
    },
  }
}

function _router_route(route: RWRoute): TreeItem2 {
  return {
    label: route.outlineLabel,
    description: route.outlineDescription,
    command: Command_open(route.location),
    iconPath: route.isPrivate ? 'gist-secret' : 'gist',
    menu: {
      kind: 'route',
      openComponent: route.page ? Command_open(route.page.uri) : undefined,
      openRoute: Command_open(route.location),
      openInBrowser: Command_cli(`rw dev --open='${route.path}'`),
    },
  }
}

function _pages(project: RWProject): TreeItem2 {
  return {
    label: 'pages',
    iconPath: 'globe',
    children: () => project.pages.map(_pages_page),
    menu: {
      kind: 'group',
      add: Command_cli('rw generate page ...'),
      doc: Command_open('https://redwoodjs.com/tutorial/our-first-page'),
    },
  }
}

function _pages_page(page: RWPage): TreeItem2 {
  return {
    id: page.id,
    label: page.outlineLabel,
    ...resourceUriAndCommandFor(page.uri),
    description: page.outlineLabel,
    children: () => [
      _rwcli_command_group({
        cmd: 'rw destroy page ' + page.basenameNoExt,
        tooltip: 'Delete page and related files',
      }),
    ],
  }
}

function _components(project: RWProject): TreeItem2 {
  return {
    label: 'components',
    iconPath: 'extensions',
    children: () => fromFiles(project.components.filter((c) => !c.isCell)),
    menu: {
      kind: 'group',
      add: Command_cli('rw generate component ...'),
      doc: Command_open(
        'https://redwoodjs.com/docs/cli-commands.html#component'
      ),
    },
  }
}

function _layouts(project: RWProject): TreeItem2 {
  return {
    label: 'layouts',
    iconPath: 'preview',
    children: () => fromFiles(project.layouts),
    menu: {
      kind: 'group',
      add: Command_cli('rw generate layout ...'),
      doc: Command_open('https://redwoodjs.com/tutorial/layouts'),
    },
  }
}

function _cells(project: RWProject): TreeItem2 {
  return {
    label: 'cells',
    iconPath: 'circuit-board',
    children: () => project.cells.map(render),
    menu: {
      kind: 'group',
      add: Command_cli('rw generate cell ...'),
      doc: Command_open('https://redwoodjs.com/tutorial/cells'),
    },
  }
}

function _services(project: RWProject): TreeItem2 {
  return {
    label: 'services',
    iconPath: 'server',
    children: () => fromFiles(project.services),
    menu: {
      kind: 'group',
      add: Command_cli('rw generate service ...'),
      doc: Command_open('https://redwoodjs.com/docs/cli-commands.html#service'),
    },
  }
}

function _functions(project: RWProject): TreeItem2 {
  const [fs_b, fs] = partition(project.functions, (f) => f.isBackground)
  return {
    label: 'functions',
    iconPath: 'server-process',
    // TODO: link to published function
    // http://localhost:8911/graphql
    children: () => [
      ...fromFiles(fs),
      {
        label: 'background functions',
        children: () => fromFiles(fs_b),
      },
    ],
    menu: {
      kind: 'group',
      add: Command_cli('rw generate function ...'),
      doc: Command_open('https://redwoodjs.com/docs/serverless-functions'),
    },
  }
}

function _schema(project: RWProject): TreeItem2 {
  return {
    label: 'schema.prisma',
    iconPath: 'x-prisma',
    menu: {
      kind: 'withDoc',
      doc: Command_open(
        'https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-schema'
      ),
    },
    ...resourceUriAndCommandFor(project.pathHelper.api.dbSchema),
    async children() {
      const dmmf = await project.prismaDMMF()
      if (!dmmf) return []
      const models = dmmf.datamodel.models.map((model) => {
        return {
          label: model.name,
          iconPath: 'database',
          // TODO: location for models and fields
          children() {
            const fields = model.fields.map((f) => ({
              label: f.name,
              iconPath: 'symbol-field',
              description: `${f.type}`,
            }))
            const commands = _rwcli_command_group(
              {
                tooltip: 'create graphql interface to access this model',
                cmd: `generate sdl ${model.name}`,
              },
              {
                cmd: `generate scaffold ${model.name}`,
                tooltip:
                  'generate pages, SDL, and a services object for this model',
              }
            )
            return [...fields, commands]
          },
        }
      })
      const commands = _rwcli_command_group(
        {
          cmd: 'db save',
          tooltip: 'save migration file with new changes',
        },
        {
          cmd: 'db up',
          tooltip: 'apply migrations',
        }
      )
      return [...models, commands]
    },
  }
}

interface RWOpts {
  cmd: string
  tooltip: string
}

function _rwcli_command_group(...opts: RWOpts[]): TreeItem2 {
  return {
    label: 'rw cli',
    key: 'rw-cli-commands',
    tooltip: 'Redwood.js CLI commands',
    iconPath: 'terminal',
    children: () => opts.map(_rwcli_command),
    menu: {
      kind: 'withDoc',
      doc: Command_open('https://redwoodjs.com/docs/cli-commands'),
    },
  }
}

function _rwcli_command(opts: RWOpts): TreeItem2 {
  const { cmd, tooltip } = opts
  return {
    label: cmd,
    tooltip,
    menu: {
      kind: 'cli',
      run: Command_cli(cmd),
    },
  }
}

function fromFiles(
  fileNodes: any //FileNode[]
): TreeItem2[] {
  return fileNodes.map(fromFile)
}

function fromFile(
  fileNode: any
  //FileNode
): TreeItem2 {
  return {
    label: fileNode.basename,
    ...resourceUriAndCommandFor(fileNode.uri),
  }
}

function resourceUriAndCommandFor(
  uri: string
): Pick<TreeItem2, 'resourceUri' | 'command'> {
  uri = URL_file(uri)
  return {
    resourceUri: uri,
    command: Command_open(uri),
  }
}

type RenderableNode = DocumentUri | BaseNode | TreeItem2

function render(x: any /*BaseNode*/): TreeItem2 {
  if (x instanceof RWCell) {
    return {
      ...fromFile(x),
      children: () => renderRelatedArtifacts(x.uri),
    }
  }
  // if (x instanceof RWService) {
  //   return {
  //     ...fromFile(x),
  //     children: () => {
  //       x.funcs.map(render)
  //       return renderRelatedArtifacts(x.uri)
  //     },
  //   }
  // }

  if (x instanceof RWServiceFunction) {
    return {
      label: x.name,
    }
  }
  // basic catch-all for file nodes
  if (x instanceof FileNode) {
    return {
      ...fromFile(x),
      children: () => renderRelatedArtifacts(x.uri),
    }
  }
  throw new Error('render not implemented for node type ' + x)
}

function renderRelatedArtifacts(fileURI: string): TreeItem2[] {
  return Array.from(relatedArtifacts(fileURI)).map(resourceUriAndCommandFor)
}

/**
 * if file follows dirname convention, then this returns
 * all files in the same dir (mocks, stories, tests, etc)
 * @param fileURI
 */
function* relatedArtifacts(fileURI: string) {
  // make sure this is a URI
  fileURI = URL_file(fileURI)
  const filePath = URL_toFile(fileURI)
  // if this file follows the dirname convention
  const fdc = followsDirNameConvention(filePath)
  if (fdc) {
    // get all files in the same dir
    const dir = dirname(filePath)
    for (const dd of readdirSync(dir)) {
      const file2 = join(dir, dd)
      const file2URI = URL_file(file2)
      if (file2URI === fileURI) continue // do not list same file
      yield file2URI
    }
  }
}
