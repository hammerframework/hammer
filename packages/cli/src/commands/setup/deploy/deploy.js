import fs from 'fs'
import path from 'path'

import boxen from 'boxen'
import execa from 'execa'
import Listr from 'listr'
import terminalLink from 'terminal-link'

import { getPaths, writeFilesTask } from 'src/lib'
import c from 'src/lib/colors'

const REDWOOD_TOML_PATH = path.join(getPaths().base, 'redwood.toml')
const SUPPORTED_PROVIDERS = fs
  .readdirSync(path.resolve(__dirname, 'providers'))
  .map((file) => path.basename(file, '.js'))
  .filter((file) => file !== 'README.md')

const updateApiURL = (apiURL) => {
  const redwoodToml = fs.readFileSync(REDWOOD_TOML_PATH).toString()
  let newRedwoodToml = redwoodToml

  if (redwoodToml.match(/apiURL/)) {
    newRedwoodToml = newRedwoodToml.replace(/apiURL.*/g, `apiURL = "${apiURL}"`)
  } else if (redwoodToml.match(/\[web\]/)) {
    newRedwoodToml = newRedwoodToml.replace(
      /\[web\]/,
      `[web]\n  apiURL = "${apiURL}"`
    )
  } else {
    newRedwoodToml += `[web]\n  apiURL = "${apiURL}"`
  }

  fs.writeFileSync(REDWOOD_TOML_PATH, newRedwoodToml)
}

export const command = 'deploy <provider>'
export const description = 'Generate a deployment configuration'
export const builder = (yargs) => {
  yargs
    .positional('provider', {
      choices: SUPPORTED_PROVIDERS,
      description: 'Deploy provider to configure',
      type: 'string',
    })
    .option('force', {
      alias: 'f',
      default: false,
      description: 'Overwrite existing configuration',
      type: 'boolean',
    })
    .option('database', {
      alias: 'd',
      choices: ['none', 'postgresql', 'sqlite'],
      description: 'Database deployment for Render only',
      type: 'string',
    })
    .check((argv) => {
      if (argv.provider !== 'render' && argv.database !== undefined) {
        throw new Error('Database option only available for Render deployment')
      }
      if (argv.provider === 'render' && argv.database === undefined) {
        argv.database = 'postgresql'
      }
      return true
    })
    .epilogue(
      `Also see the ${terminalLink(
        'Redwood CLI Reference',
        'https://redwoodjs.com/reference/command-line-interface#generate-deploy'
      )}`
    )
}

export const handler = async ({ provider, force, database }) => {
  const providerData = await import(`./providers/${provider}`)
  const apiDependencies = JSON.parse(
    fs.readFileSync('api/package.json').toString()
  ).dependencies

  const missingApiPackages = providerData?.apiPackages?.reduce(
    (missingPackages, apiPackage) => {
      if (!(apiPackage in apiDependencies)) {
        missingPackages.push(apiPackage)
      }
      return missingPackages
    },
    []
  )

  const tasks = new Listr(
    [
      providerData?.preRequisites?.length && {
        title: 'Checking pre-requisites',
        task: () =>
          new Listr(
            providerData.preRequisites.map((preReq) => {
              return {
                title: preReq.title,
                task: async () => {
                  try {
                    await execa(...preReq.command)
                  } catch (error) {
                    error.message =
                      error.message + '\n' + preReq.errorMessage.join(' ')
                    throw error
                  }
                },
              }
            })
          ),
      },
      providerData?.prismaDataSourceCheck && {
        title: 'Checking Prisma data source provider...',
        task: async () => {
          const fileData = await providerData.prismaDataSourceCheck(database)
          let files = {}
          files[fileData.path] = fileData.content
          return writeFilesTask(files, { overwriteExisting: force })
        },
      },
      missingApiPackages?.length && {
        title: 'Adding required api packages...',
        task: async () => {
          await execa('yarn', [
            'workspace',
            'api',
            'add',
            ...missingApiPackages,
          ])
        },
      },
      providerData?.apiDevPackages?.length && {
        title: 'Adding required api dev packages...',
        task: async () => {
          await execa('yarn', [
            'workspace',
            'api',
            'add',
            '-D',
            ...providerData.apiDevPackages,
          ])
        },
      },
      {
        title: 'Installing packages...',
        task: async () => {
          await execa('yarn', ['install'])
        },
      },
      providerData?.apiURL && {
        title: 'Updating API URL...',
        task: async () => {
          updateApiURL(providerData.apiURL)
        },
      },
      providerData?.files?.length && {
        title: 'Adding config...',
        task: async () => {
          let files = {}
          providerData.files.forEach((fileData) => {
            files[fileData.path] = fileData.content
          })
          return writeFilesTask(files, { overwriteExisting: force })
        },
      },
      providerData?.gitIgnoreAdditions?.length &&
        fs.existsSync(path.resolve(getPaths().base, '.gitignore')) && {
          title: 'Updating .gitignore...',
          task: async (_ctx, task) => {
            const gitIgnore = path.resolve(getPaths().base, '.gitignore')
            const content = fs.readFileSync(gitIgnore).toString()

            if (
              providerData.gitIgnoreAdditions.every((item) =>
                content.includes(item)
              )
            ) {
              task.skip('.gitignore already includes the additions.')
            }

            fs.appendFileSync(
              gitIgnore,
              ['\n', '# Deployment', ...providerData.gitIgnoreAdditions].join(
                '\n'
              )
            )
          },
        },
      providerData?.prismaBinaryTargetAdditions && {
        title: 'Adding necessary Prisma binaries...',
        task: () => providerData.prismaBinaryTargetAdditions(),
      },
      {
        title: 'One more thing...',
        task: (_ctx, task) => {
          task.title = `One more thing...\n\n ${boxen(
            providerData.notes.join('\n   '),
            {
              padding: { top: 0, bottom: 0, right: 0, left: 0 },
              margin: 1,
              borderColour: 'gray',
            }
          )}  \n`
        },
      },
    ].filter(Boolean),
    { collapse: false }
  )

  try {
    await tasks.run()
  } catch (e) {
    console.error(c.error(e.message))
    process.exit(e?.exitCode || 1)
  }
}
