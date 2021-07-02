import path from 'path'

const FIXTURE_PATH = path.resolve(
  __dirname,
  '../../../../__fixtures__/example-todo-main'
)

beforeAll(() => {
  process.env.RWJS_CWD = FIXTURE_PATH
})
afterAll(() => {
  delete process.env.RWJS_CWD
})

import {
  findApiServerFunctions,
  findCells,
  findDirectoryNamedModules,
  findGraphQLSchemas,
  findPages,
} from '../files'
import { ensurePosixPath } from '../paths'

const cleanPaths = (p) => {
  return ensurePosixPath(path.relative(FIXTURE_PATH, p))
}

test('finds all the cells', () => {
  const paths = findCells()
  const p = paths.map(cleanPaths)

  expect(p).toMatchInlineSnapshot(`
    Array [
      "web/src/components/NumTodosCell/NumTodosCell.js",
      "web/src/components/TodoListCell/TodoListCell.tsx",
    ]
  `)
})

test('finds directory named modules', () => {
  const paths = findDirectoryNamedModules()
  const p = paths.map(cleanPaths)

  expect(p).toMatchInlineSnapshot(`
    Array [
      "api/src/functions/healthz/healthz.js",
      "api/src/services/todos/todos.js",
      "web/src/components/AddTodo/AddTodo.js",
      "web/src/components/AddTodoControl/AddTodoControl.js",
      "web/src/components/Check/Check.js",
      "web/src/components/TableCell/TableCell.js",
      "web/src/components/TodoItem/TodoItem.js",
      "web/src/layouts/SetLayout/SetLayout.js",
      "web/src/pages/BarPage/BarPage.tsx",
      "web/src/pages/FatalErrorPage/FatalErrorPage.js",
      "web/src/pages/FooPage/FooPage.tsx",
      "web/src/pages/HomePage/HomePage.tsx",
      "web/src/pages/NotFoundPage/NotFoundPage.js",
      "web/src/pages/TypeScriptPage/TypeScriptPage.tsx",
      "web/src/pages/admin/EditUserPage/EditUserPage.jsx",
    ]
  `)
})

test('finds all the page files', () => {
  const paths = findPages()
  const p = paths.map(cleanPaths)

  expect(p).toMatchInlineSnapshot(`
    Array [
      "web/src/pages/BarPage/BarPage.tsx",
      "web/src/pages/FatalErrorPage/FatalErrorPage.js",
      "web/src/pages/FooPage/FooPage.tsx",
      "web/src/pages/HomePage/HomePage.tsx",
      "web/src/pages/NotFoundPage/NotFoundPage.js",
      "web/src/pages/TypeScriptPage/TypeScriptPage.tsx",
      "web/src/pages/admin/EditUserPage/EditUserPage.jsx",
    ]
  `)
})

test('find the graphql schema files', () => {
  const paths = findGraphQLSchemas()
  const p = paths.map(cleanPaths)

  expect(p[0]).toMatchInlineSnapshot(`"api/src/graphql/currentUser.sdl.ts"`)
  expect(p[1]).toMatchInlineSnapshot(`"api/src/graphql/todos.sdl.js"`)
})

test('find api functions', () => {
  const paths = findApiServerFunctions()
  const p = paths.map(cleanPaths)
  expect(p).toMatchInlineSnapshot(`
    Array [
      "api/src/functions/graphql.js",
      "api/src/functions/healthz/healthz.js",
      "api/src/functions/x/index.js",
    ]
  `)
})
