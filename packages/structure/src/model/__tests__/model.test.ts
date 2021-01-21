import { basename, resolve } from 'path'

import { DefaultHost } from '../../hosts'
import { URL_file } from '../../x/URL'
import { RWProject } from '../RWProject'
import { OutlineInfoResolver } from '../types'

describe('Redwood Project Model', () => {
  it('can process example-todo-main', async () => {
    const projectRoot = getFixtureDir('example-todo-main')
    const project = new RWProject({ projectRoot, host: new DefaultHost() })

    const pageNames = new Set(project.pages.map((p) => p.basenameNoExt))
    expect(pageNames).toEqual(
      new Set(['FatalErrorPage', 'HomePage', 'NotFoundPage'])
    )
    for (const page of project.pages) {
      page.basenameNoExt //?
      page.route?.id //?
    }
    expect(project.sdls.map((s) => s.name)).toEqual(['todos']) //?

    for (const c of project.components) {
      c.basenameNoExt //?
    }
    project.components.length //?
    project.components.map((c) => c.basenameNoExt) //?
    project.functions.length //?
    project.services.length //?
    project.sdls.length //?
    const ds = await project.collectDiagnostics()
    ds.length //?
    const uri = URL_file(projectRoot, 'api/src/graphql/todos.sdl.js') //?
    const node = await project.findNode(uri)
    expect(node).toBeDefined()
    expect(node.id).toEqual(uri)
    if (node) {
      const info = await node.collectIDEInfo()
      info.length //?
      info //?
    }
  })

  it('example-todo-main-with-errors', async () => {
    const projectRoot = getFixtureDir('example-todo-main-with-errors')
    const project = new RWProject({ projectRoot, host: new DefaultHost() })
    const ds = await project.collectDiagnostics()
    expect(ds.length).toBeGreaterThan(0)
    // const diagnosticCodes = new Set(ds.map((d) => d.diagnostic.code))
    // expect(diagnosticCodes).toEqual(
    //   new Set([RWError.NOTFOUND_PAGE_NOT_DEFINED])
    // )
    const dss = await project.router.collectDiagnostics()
    expect(dss.length).toBeGreaterThan(0)
  })
})

describe('Cells', () => {
  it('Correctly determines a Cell component vs a normal component', () => {
    const projectRoot = getFixtureDir('example-todo-main-with-errors')
    const project = new RWProject({ projectRoot, host: new DefaultHost() })
    const cells = project.cells
    expect(cells).toHaveLength(1)
    expect(cells.map((cell) => basename(cell.filePath))).not.toContain(
      'TableCell.js'
    )
  })

  it('Can get the operation name of the QUERY', () => {
    const projectRoot = getFixtureDir('example-todo-main')
    const project = new RWProject({ projectRoot, host: new DefaultHost() })
    const cell = project.cells.find((x) => x.uri.endsWith('TodoListCell.js'))
    expect(cell.queryOperationName).toMatch('TodoListCell_GetTodos')
  })

  it('Warns you when you do not supply a name to QUERY', async (done) => {
    const projectRoot = getFixtureDir('example-todo-main-with-errors')
    const project = new RWProject({ projectRoot, host: new DefaultHost() })

    const cell = project.cells.find((x) => x.uri.endsWith('TodoListCell.js'))
    const x = await cell.collectDiagnostics()
    expect(x.map((e) => e.diagnostic.message)).toContain(
      'We recommend that you name your query operation'
    )
    done()
  })
})

import { parse as graphql_parse, buildSchema } from 'graphql'
import {
  getFieldDef,
  getHoverInformation,
  getOutline,
} from 'graphql-language-service-interface'

describe.only('graphql stuff', async () => {
  console.log('hello world')
  // const languageService = new LanguageService({
  //   schemaConfig: { uri: 'https://my/schema' },
  // })
  const exampleschema = `
    schema {
      query: Query
      # mutation: Mutation
    }
    type Query {
      hero(episode: Episode): Character
    }
    type Character {
      name: String!
      appearsIn: [Episode!]!
    }
    enum Episode {
      NEWHOPE
      EMPIRE
      JEDI
    }
  `
  const outline = getOutline(exampleschema)
  outline //?
  const schema = buildSchema(exampleschema)
  schema //?
  const info = getHoverInformation(schema, '{ hero { name } }', {
    character: 4,
    line: 0,
  })
  info //?
})

describe.only('Page', () => {
  it('Finds page layout', async () => {
    //const projectRoot = getFixtureDir('example-todo-main')
    const projectRoot = '/Users/aldo/com.github/redwoodjs/example-blog'
    const project = new RWProject({ projectRoot, host: new DefaultHost() })

    const rr = new OutlineInfoResolver(project)
    const item = await rr.treeItem()
    item //?
    const cc2 = await rr.children_treeItem()
    cc2.length //?
    cc2[0].label //?
    const children = await item.children()
    children.length //?
    // foo

    const cc = await project.outlineChildren()
    cc.length //?

    const pages = project.pages
    pages.length //?
    pages.map((p) => p.basenameNoExt) //?
    for (const page of pages) {
      for (const nn of await page.sf_withReferences_referencedSourceFiles_as_FileNodes()) {
        nn.filePath //?
      }
    }
  })
})

describe.skip('env vars', () => {
  it('Warns if env vars are not ok', async () => {
    const projectRoot = getFixtureDir('example-todo-main-with-errors')
    const project = new RWProject({ projectRoot, host: new DefaultHost() })
    project.envHelper.process_env_expressions.length //?
    const env = project.envHelper
    env.env //?
    env.env_defaults //?
    project.redwoodTOML.web_includeEnvironmentVariables //?
    env.process_env_expressions //?
  })
})

function getFixtureDir(
  name: 'example-todo-main-with-errors' | 'example-todo-main'
) {
  return resolve(__dirname, `../../../../../__fixtures__/${name}`)
}
