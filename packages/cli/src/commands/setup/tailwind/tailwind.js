import fs from 'fs'
import path from 'path'

import chalk from 'chalk'
import execa from 'execa'
import Listr from 'listr'

import { getPaths, writeFile } from 'src/lib'
import c from 'src/lib/colors'

export const command = 'tailwind'
export const description = 'Setup tailwindcss and PostCSS'
export const builder = (yargs) => {
  yargs.option('force', {
    alias: 'f',
    default: false,
    description: 'Overwrite existing configuration',
    type: 'boolean',
  })
}

const tailwindImportsAndNotes = [
  '/**',
  ' * START --- TAILWIND GENERATOR EDIT',
  ' *',
  ' * `yarn rw setup tailwind` placed these imports here',
  " * to inject Tailwind's styles into your CSS.",
  ' * For more information, see: https://tailwindcss.com/docs/installation#add-tailwind-to-your-css',
  ' */',
  '@import "tailwindcss/base";',
  '@import "tailwindcss/components";',
  '@import "tailwindcss/utilities";',
  '/**',
  ' * END --- TAILWIND GENERATOR EDIT',
  ' */\n',
]

const INDEX_CSS_PATH = path.join(getPaths().web.src, 'index.css')

const tailwindImportsExist = (indexCSS) => {
  let content = indexCSS.toString()

  const hasBaseImport = () => /@import "tailwindcss\/base"/.test(content)

  const hasComponentsImport = () =>
    /@import "tailwindcss\/components"/.test(content)

  const hasUtilitiesImport = () =>
    /@import "tailwindcss\/utilities"/.test(content)

  return hasBaseImport() && hasComponentsImport() && hasUtilitiesImport()
}

const postCSSConfigExists = () => {
  return fs.existsSync(getPaths().web.postcss)
}

export const handler = async ({ force }) => {
  const tasks = new Listr([
    {
      title: 'Installing packages...',
      task: () => {
        return new Listr([
          {
            title: 'Install postcss-loader, tailwindcss, and autoprefixer',
            task: async () => {
              /**
               * Install postcss-loader, tailwindcss, and autoprefixer
               * RedwoodJS currently uses PostCSS v7; postcss-loader and autoprefixers pinned for compatibility
               */
              await execa('yarn', [
                'workspace',
                'web',
                'add',
                '-D',
                'postcss-loader@latest',
                'tailwindcss@latest',
                'autoprefixer@latest',
              ])
            },
          },
          {
            title: 'Sync yarn.lock and node_modules',
            task: async () => {
              /**
               * Sync yarn.lock file and node_modules folder.
               * Refer https://github.com/redwoodjs/redwood/issues/1301 for more details.
               */
              await execa('yarn', ['install', '--check-files'])
            },
          },
        ])
      },
    },
    {
      title: 'Configuring PostCSS...',
      task: () => {
        /**
         * Make web/config if it doesn't exist
         * and write postcss.config.js there
         */

        /**
         * Check if PostCSS config already exists.
         * If it exists, throw an error.
         */
        if (!force && postCSSConfigExists()) {
          throw new Error(
            'PostCSS config already exists.\nUse --force to override existing config.'
          )
        } else {
          return writeFile(
            getPaths().web.postcss,
            fs
              .readFileSync(
                path.resolve(
                  __dirname,
                  'templates',
                  'postcss.config.js.template'
                )
              )
              .toString(),
            { overwriteExisting: force }
          )
        }
      },
    },
    {
      title: 'Initializing Tailwind CSS...',
      task: async () => {
        const basePath = getPaths().web.base
        const tailwindConfigPath = path.join(basePath, 'tailwind.config.js')
        const configExists = fs.existsSync(tailwindConfigPath)

        if (configExists) {
          if (force) {
            // yarn tailwindcss init will fail if the file already exists
            fs.unlinkSync(tailwindConfigPath)
          } else {
            throw new Error(
              'Tailwindcss config already exists.\nUse --force to override existing config.'
            )
          }
        }

        await execa('yarn', ['tailwindcss', 'init'], { cwd: basePath })

        // opt-in to upcoming changes
        const config = fs.readFileSync(tailwindConfigPath, 'utf-8')

        const uncommentFlags = (str) =>
          str.replace(/\/{2} ([\w-]+: true)/g, '$1')

        const newConfig = config.replace(/future.*purge/s, uncommentFlags)

        fs.writeFileSync(tailwindConfigPath, newConfig)
      },
    },
    {
      title: 'Adding imports to index.css...',
      task: (_ctx, task) => {
        /**
         * Add tailwind imports and notes to the top of index.css
         */
        let indexCSS = fs.readFileSync(INDEX_CSS_PATH)

        if (tailwindImportsExist(indexCSS)) {
          task.skip('Imports already exist in index.css')
        } else {
          indexCSS = tailwindImportsAndNotes.join('\n') + indexCSS
          fs.writeFileSync(INDEX_CSS_PATH, indexCSS)
        }
      },
    },
    {
      title: 'One more thing...',
      task: (_ctx, task) => {
        task.title = `One more thing...\n
          ${c.green(
            'Tailwind configured with "upcoming change" opt-in enabled'
          )}\n
          ${chalk.hex('#e8e8e8')(
            'See this doc for info: https://tailwindcss.com/docs/upcoming-changes'
          )}
        `
      },
    },
  ])

  try {
    await tasks.run()
  } catch (e) {
    console.error(c.error(e.message))
    process.exit(e?.exitCode || 1)
  }
}
