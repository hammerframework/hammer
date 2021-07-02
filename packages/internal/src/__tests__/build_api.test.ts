import path from 'path'

import { prebuildApiFiles } from '../build/api'
import { findApiFiles } from '../files'

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

test('api files are prebuilt', () => {
  const builtFiles = prebuildApiFiles(findApiFiles())
  expect(builtFiles[0].endsWith('api/src/functions/graphql.js')).toBeTruthy()
  expect(builtFiles[2].endsWith('api/src/graphql/todos.sdl.js')).toBeTruthy()
})
