jest.mock('execa', () =>
  jest.fn((cmd, params, options) => {
    return {
      cmd,
      params,
      options,
    }
  })
)

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
      base: './myBasePath',
      api: {
        dbSchema: '../../__fixtures__/example-todo-main/api/prisma',
      },
      web: {},
    }),
    getConfig: () => {
      return mockedRedwoodConfig
    },
  }
})

import path from 'path'

import execa from 'execa'

import { runCommandTask } from 'src/lib'

import { handler } from '../type-check'

afterEach(() => {
  jest.clearAllMocks()
})

test('Should run tsc commands correctly, in order', async () => {
  await handler({
    sides: ['web', 'api'],
    prisma: false,
  })

  expect(execa.mock.results[0].value.cmd).toEqual('yarn rw-gen')

  // Ensure tsc command run correctly for web side
  expect(execa.mock.results[1].value.cmd).toEqual('yarn tsc')
  expect(execa.mock.results[1].value.params).toContain('--noEmit')
  expect(execa.mock.results[1].value.params).toContain('--skipLibCheck')
  expect(execa.mock.results[1].value.options.cwd).toBe(
    path.normalize('myBasePath/web')
  )

  // Ensure tsc command run correctly for web side
  expect(execa.mock.results[2].value.cmd).toEqual('yarn tsc')
  expect(execa.mock.results[2].value.params).toContain('--noEmit')
  expect(execa.mock.results[2].value.params).toContain('--skipLibCheck')
  expect(execa.mock.results[2].value.options.cwd).toBe(
    path.normalize('myBasePath/api')
  )
})

test('Should generate prisma client', async () => {
  await handler({
    sides: ['api'],
    prisma: true,
  })

  expect(execa.mock.results[0].value.cmd).toEqual('yarn rw-gen')

  // Ensure tsc command run correctly for api side
  expect(execa.mock.results[1].value.cmd).toEqual('yarn tsc')
  expect(runCommandTask.mock.results[0].value[0]).toEqual(
    'yarn prisma generate --schema="../../__fixtures__/example-todo-main/api/prisma"'
  )
  expect(execa.mock.results[1].value.options.cwd).toBe(
    path.normalize('myBasePath/api')
  )
})
