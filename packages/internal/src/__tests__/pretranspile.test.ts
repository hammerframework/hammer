import path from 'path'

import { findCells } from '../files'
import { getPaths } from '../paths'
import { pretranspileFile, pretranspileWeb } from '../pretranspile'

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

test('`src` aliases and directory named modules are resolved', () => {
  const rwjsPath = getPaths()
  const result = pretranspileFile(rwjsPath.web.routes)
  expect(result.code).toContain(
    `import SetLayout from "./layouts/SetLayout/SetLayout";`
  )
})

test('cell files are converted', () => {
  const cellPath = findCells()[1]
  const result = pretranspileFile(cellPath)
  expect(result.code).toContain(
    `export default createCell({ QUERY, afterQuery, Loading, Success });`
  )
})

test('automatically imports gql and react', () => {
  const cellPath = findCells()[1]
  const result = pretranspileFile(cellPath)
  expect(result.code).toContain(`gql from "graphql-tag"`)
  // TODO: Test React.
})

test('gql template literal is transpiled to ast', () => {
  const cellPath = findCells()[1]
  const result = pretranspileFile(cellPath)
  // TODO: This is not working...
})

test('pages are automatically imported', () => {
  const rwjsPath = getPaths()
  const result = pretranspileFile(rwjsPath.web.routes)
  expect(result?.code).toContain(
    `const FatalErrorPage = { name: "FatalErrorPage", loader: () => import("./pages/FatalErrorPage/FatalErrorPage") };`
  )
})

test('pretranspiles all the web files', () => {
  pretranspileWeb()
})
