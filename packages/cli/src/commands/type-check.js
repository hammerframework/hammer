import path from 'path'

import execa from 'execa'
import Listr from 'listr'
import VerboseRenderer from 'listr-verbose-renderer'
import terminalLink from 'terminal-link'

import { getProject } from '@redwoodjs/structure'

import { getPaths } from 'src/lib'
import c from 'src/lib/colors'
import { generatePrismaClient } from 'src/lib/generatePrismaClient'

export const command = 'type-check [sides..]'
export const aliases = ['tsc', 'tc']
export const description = 'Run a TypeScript compiler check on your project'
export const builder = (yargs) => {
  yargs
    .strict(false) // so that we can forward arguments to tsc
    .positional('sides', {
      default: getProject().sides,
      description: 'Which side(s) to run a typecheck on',
      type: 'array',
    })
    .option('prisma', {
      type: 'boolean',
      default: true,
      description: 'Generate the Prisma client',
    })
    .option('verbose', {
      alias: 'v',
      default: true,
      description: 'Print more',
      type: 'boolean',
    })
    .epilogue(
      `Also see the ${terminalLink(
        'Redwood CLI Reference',
        'https://redwoodjs.com/reference/command-line-interface#type-check'
      )}`
    )
}

export const handler = async ({ sides, verbose, prisma }) => {
  const listrTasks = [
    {
      title: 'Generating redwood types...',
      task: () => {
        return execa('yarn rw-gen', [], {
          stdio: verbose ? 'inherit' : 'pipe',
          shell: true,
          cwd: getPaths().web.base,
        })
      },
    },
    {
      title: 'Generating prisma client...',
      task: () => {
        return generatePrismaClient({
          verbose: true,
          schema: getPaths().api.dbSchema,
        })
      },
      enabled: () => prisma,
      skip: () => {
        if (!sides.includes('api')) {
          return 'Skipping, as no api side present'
        }
      },
    },
  ]

  sides.forEach((sideName) => {
    const cwd = path.join(getPaths().base, sideName)
    listrTasks.push({
      title: `Typechecking "${sideName}"...`,
      task: () => {
        return execa('yarn tsc', ['--noEmit', '--skipLibCheck'], {
          stdio: verbose ? 'inherit' : 'pipe',
          shell: true,
          cwd,
        })
      },
    })
  })

  const tasks = new Listr(listrTasks, {
    renderer: verbose && VerboseRenderer,
  })

  try {
    await tasks.run()
  } catch (e) {
    console.log(c.error(e.message))
    process.exit(e?.exitCode || 1)
  }
}
