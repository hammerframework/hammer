import path from 'path'

import babelRequireHook from '@babel/register'
import Listr from 'listr'
import VerboseRenderer from 'listr-verbose-renderer'
import terminalLink from 'terminal-link'

import { getPaths } from 'src/lib'
import c from 'src/lib/colors'
import { generatePrismaClient } from 'src/lib/generatePrismaClient'

const runScript = async (scriptPath, scriptArgs) => {
  const script = await import(scriptPath)
  await script.default({ args: scriptArgs })

  try {
    const { db } = await import(path.join(getPaths().api.lib, 'db'))
    db.$disconnect()
  } catch (e) {
    // silence
  }

  return
}

export const command = 'exec <name>'
export const description = 'Run scripts generated with yarn generate script'
export const builder = (yargs) => {
  yargs
    .positional('name', {
      description: 'The file name (extension is optional) of the script to run',
      type: 'string',
    })
    .strict(false)
    .epilogue(
      `Also see the ${terminalLink(
        'Redwood CLI Reference',
        'https://redwoodjs.com/docs/cli-commands#up'
      )}`
    )
}

export const handler = async (args) => {
  const { name, ...scriptArgs } = args
  const scriptPath = path.join(getPaths().scripts, name)

  // Import babel config for running script
  babelRequireHook({
    extends: path.join(getPaths().api.base, '.babelrc.js'),
    extensions: ['.js', '.ts'],
    plugins: [
      [
        'babel-plugin-module-resolver',
        {
          alias: {
            $api: getPaths().api.base,
          },
        },
      ],
    ],
    ignore: ['node_modules'],
    cache: false,
  })

  try {
    require.resolve(scriptPath)
  } catch {
    console.error(c.error(`\nNo script module exists with that name.\n`))
    process.exit(1)
  }

  const scriptTasks = [
    {
      title: 'Generating Prisma client',
      task: () => generatePrismaClient({ force: false }),
    },
    {
      title: 'Running script',
      task: async () => {
        try {
          await runScript(scriptPath, scriptArgs)
        } catch (e) {
          console.error(c.error(`Error in script: ${e.message}`))
        }
      },
    },
  ]

  const tasks = new Listr(scriptTasks, {
    collapse: false,
    renderer: VerboseRenderer,
  })

  try {
    await tasks.run()
  } catch (e) {
    console.error(c.error(`The script exited with errors.`))
    process.exit(e?.exitCode || 1)
  }
}
