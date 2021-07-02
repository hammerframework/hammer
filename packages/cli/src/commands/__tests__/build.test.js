jest.mock('execa', () => jest.fn((cmd) => cmd))

jest.mock('../prerender', () => {
  return {
    getTasks: jest.fn(),
  }
})

let mockedRedwoodConfig = {
  api: {},
  web: {},
  browser: {},
}

jest.mock('src/lib', () => {
  return {
    ...jest.requireActual('src/lib'),
    runCommandTask: jest.fn((commands) => {
      return commands.map(({ cmd, args }) => `${cmd} ${args?.join(' ')}`)
    }),
    getPaths: () => ({
      base: './',
      api: {
        dbSchema: '../../__fixtures__/example-todo-main/api/prisma',
        dist: 'my-api-dist-path/',
      },
      web: {},
    }),
    getConfig: () => {
      return mockedRedwoodConfig
    },
  }
})

let mockedPrerenderRoutes = ['Pretend', 'Some', 'Routes', 'Are', 'There']
// For the prerender tests
jest.mock('@redwoodjs/prerender/detection', () => {
  return { detectPrerenderRoutes: () => mockedPrerenderRoutes }
})

import execa from 'execa'

import { runCommandTask } from 'src/lib'

import { handler } from '../build'
import { getTasks as getPrerenderTasks } from '../prerender'

afterEach(() => {
  jest.clearAllMocks()
})

test('Should clean web dist directory, before build', async () => {
  await handler({})
  expect(execa.mock.results[0].value).toEqual(`rimraf dist/*`)
})

test('The build command runs the correct commands.', async () => {
  await handler({})

  // Prisma command is inserted differently
  expect(runCommandTask.mock.results[0].value[0]).toEqual(
    'yarn prisma generate --schema="../../__fixtures__/example-todo-main/api/prisma"'
  )

  expect(execa.mock.results[1].value).toEqual(
    `yarn cross-env NODE_ENV=production rw-api-babel`
  )

  expect(
    execa.mock.results[2].value.startsWith(
      'yarn cross-env NODE_ENV=production webpack --config'
    )
  ).toEqual(true)

  expect(execa.mock.results[2].value.endsWith('webpack.production.js')).toEqual(
    true
  )
})

test('The build command obeys the esbuild flag', async () => {
  await handler({
    esbuild: true,
  })

  // Prisma command is inserted differently
  expect(runCommandTask.mock.results[0].value[0]).toEqual(
    'yarn prisma generate --schema="../../__fixtures__/example-todo-main/api/prisma"'
  )

  expect(execa.mock.results[1].value).toEqual(
    `yarn rimraf "my-api-dist-path/" && yarn cross-env NODE_ENV=production yarn rw-api-esbuild`
  )

  expect(
    execa.mock.results[2].value.startsWith(
      'yarn cross-env NODE_ENV=production webpack --config'
    )
  ).toEqual(true)

  expect(execa.mock.results[2].value.endsWith('webpack.production.js')).toEqual(
    true
  )
})

test('Should run prerender for web, after build', async () => {
  // Prerender is true by default
  await handler({ side: ['web'], prerender: true })

  expect(
    execa.mock.results[1].value.startsWith(
      'yarn cross-env NODE_ENV=production webpack --config'
    )
  ).toEqual(true)

  expect(execa.mock.results[1].value.endsWith('webpack.production.js')).toEqual(
    true
  )

  expect(getPrerenderTasks).toHaveBeenCalled()
})

test('Should skip prerender if no prerender routes detected', async () => {
  mockedPrerenderRoutes = []

  // Prerender is true by default
  await handler({ side: ['web'], prerender: true })

  expect(execa.mock.results[2]).toBeFalsy()
  expect(getPrerenderTasks).not.toHaveBeenCalled()
})
