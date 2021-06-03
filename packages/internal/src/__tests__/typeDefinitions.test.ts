import fs from 'fs'
import path from 'path'

import { findCells, findDirectoryNamedModules } from '../files'
import {
  generateMirrorCells,
  generateMirrorDirectoryNamedModules,
  generateTypeDefRouterPages,
  generateTypeDefCurrentUser,
  generateTypeDefRouterRoutes,
  generateTypeDefGlobImports,
  generateTypeDefGlobalContext,
  mirrorPathForDirectoryNamedModules,
  mirrorPathForCell,
  generateTypeDefScenarios,
  generateTypeDefGraphQL,
} from '../generate/typeDefinitions'
import { ensurePosixPath } from '../paths'

const FIXTURE_PATH = path.resolve(
  __dirname,
  '../../../../__fixtures__/example-todo-main'
)

beforeAll(() => {
  process.env.__REDWOOD__CONFIG_PATH = FIXTURE_PATH
})
afterAll(() => {
  delete process.env.__REDWOOD__CONFIG_PATH
})

const cleanPaths = (p) => {
  return ensurePosixPath(path.relative(FIXTURE_PATH, p))
}

test('generate the correct mirror types for cells', () => {
  const paths = generateMirrorCells()
  const p = paths.map(cleanPaths)

  expect(p).toMatchInlineSnapshot(`
    Array [
      ".redwood/types/mirror/web/src/components/NumTodosCell/index.d.ts",
      ".redwood/types/mirror/web/src/components/TodoListCell/index.d.ts",
    ]
  `)

  expect(fs.readFileSync(paths[0], 'utf-8')).toMatchInlineSnapshot(`
    "// This file was generated by RedwoodJS
    import { Success } from './NumTodosCell'
    type SuccessType = typeof Success
    export default function (): ReturnType<SuccessType>"
  `)
})

test('generate the correct mirror types for directory named modules', () => {
  const paths = generateMirrorDirectoryNamedModules()
  const p = paths.map(cleanPaths)

  expect(p).toMatchInlineSnapshot(`
    Array [
      ".redwood/types/mirror/api/src/services/todos/index.d.ts",
      ".redwood/types/mirror/web/src/components/AddTodo/index.d.ts",
      ".redwood/types/mirror/web/src/components/Check/index.d.ts",
      ".redwood/types/mirror/web/src/components/TodoItem/index.d.ts",
      ".redwood/types/mirror/web/src/layouts/SetLayout/index.d.ts",
    ]
  `)

  expect(fs.readFileSync(paths[0], 'utf-8')).toMatchInlineSnapshot(`
    "// This file was generated by RedwoodJS
    import { default as DEFAULT } from './todos'
    export default DEFAULT
    export * from './todos'
    "
  `)
})

test('generates global page imports', () => {
  const paths = generateTypeDefRouterPages()
  const p = paths.map(cleanPaths)
  expect(p[0]).toEqual('.redwood/types/includes/web-routesPages.d.ts')

  const c = fs.readFileSync(paths[0], 'utf-8')

  expect(c).toContain(`
declare global {
  const BarPage: typeof BarPageType
  const FatalErrorPage: typeof FatalErrorPageType
  const FooPage: typeof FooPageType
  const HomePage: typeof HomePageType
  const NotFoundPage: typeof NotFoundPageType
  const TypeScriptPage: typeof TypeScriptPageType
  const adminEditUserPage: typeof adminEditUserPageType
}`)
})

test('generate current user ', () => {
  const paths = generateTypeDefCurrentUser()
  const p = paths.map(cleanPaths)
  expect(p[0]).toEqual('.redwood/types/includes/all-currentUser.d.ts')
  // The type definition output is static, so there's nothing to test.
})

test('generates the router routes', () => {
  const paths = generateTypeDefRouterRoutes()
  const p = paths.map(cleanPaths)
  expect(p[0]).toEqual('.redwood/types/includes/web-routerRoutes.d.ts')

  const c = fs.readFileSync(paths[0], 'utf-8')
  expect(c).toContain(`
    home: (params?: RouteParams<"/"> & QueryParams) => "/"
    typescriptPage: (params?: RouteParams<"/typescript"> & QueryParams) => "/typescript"
    someOtherPage: (params?: RouteParams<"/somewhereElse"> & QueryParams) => "/somewhereElse"
    fooPage: (params?: RouteParams<"/foo"> & QueryParams) => "/foo"
    barPage: (params?: RouteParams<"/bar"> & QueryParams) => "/bar"
`)
})

test('generate glob imports', () => {
  const paths = generateTypeDefGlobImports()
  const p = paths.map(cleanPaths)
  expect(p[0]).toEqual('.redwood/types/includes/api-globImports.d.ts')
})

test('generate api global context', () => {
  const paths = generateTypeDefGlobalContext()
  const p = paths.map(cleanPaths)
  expect(p[0]).toEqual('.redwood/types/includes/api-globalContext.d.ts')
})

test('generate scenario type defs', () => {
  const paths = generateTypeDefScenarios()
  const p = paths.map(cleanPaths)
  expect(p[0]).toEqual('.redwood/types/includes/api-scenarios.d.ts')
})

test('Generate gql typedefs to correct paths', async () => {
  const paths = await generateTypeDefGraphQL()
  const p = paths.map(cleanPaths)

  expect(p).toEqual(
    expect.arrayContaining([
      expect.stringMatching('web/types/graphql.d.ts'),
      expect.stringMatching('api/types/graphql.d.ts'),
    ])
  )
})

test('mirror path for directory named modules', () => {
  const d = findDirectoryNamedModules()
  const p = mirrorPathForDirectoryNamedModules(d[0])

  expect(cleanPaths(p[0])).toMatchInlineSnapshot(
    `".redwood/types/mirror/api/src/services/todos"`
  )
})

test('mirror path for dir cells', () => {
  const c = findCells()
  const p = mirrorPathForCell(c[0])

  expect(cleanPaths(p[0])).toMatchInlineSnapshot(
    `".redwood/types/mirror/web/src/components/NumTodosCell"`
  )
})
