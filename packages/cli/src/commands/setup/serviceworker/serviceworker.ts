import fs from 'fs'
import path from 'path'
import Listr from 'listr'
import chalk from 'chalk'
import { getPaths, writeFile } from 'src/lib'
import c from 'src/lib/colors'

export const command = 'serviceworker'
export const description = 'Setup serviceworker for offline support'

export const builder = (yargs) => {
  yargs.option('force', {
    alias: 'f',
    default: false,
    description: 'Overwrite existing configuration',
    type: 'boolean',
  })
}

const writeTemplateTo = (
    filename: string,
    dir: string = getPaths().web.public,
    force = false
): void =>
    writeFile(
        path.join(dir, filename),
        fs
            .readFileSync(
                path.resolve(__dirname, 'templates', `${filename}.template`)
            )
            .toString(),
        { overwriteExisting: force }
    )

const writeTemplatesTo = (
    files: string[],
    dir?: string,
    force?: boolean
): void => files.forEach((file) => writeTemplateTo(file, dir, force))

function updateIndex(INDEX_PATH: string): void {
  let index = fs.readFileSync(INDEX_PATH).toString()

  const manifestString = `
  <link href="/manifest.json" rel="manifest"/>
</head>`

  const serviceWorkerString = `
<script>
  // Initialize the service worker
  if (navigator && navigator.serviceWorker) {
    navigator.serviceWorker.register('/sw.js')
  }
</script>
</body>`

  index = index.replace('</head>', manifestString)
  index = index.replace('</body>', serviceWorkerString)

  fs.writeFileSync(INDEX_PATH, index)
}

export const handler = async ({ force }: { force: boolean }) => {
  const INDEX_PATH = path.join(getPaths().web.src, 'index.html')

  const tasks = new Listr([
    {
      title: `Copying template files to ${getPaths().web.public}`,
      task: () =>
          writeTemplatesTo(
              ['manifest.json', 'offline.html', 'sw.js'],
              getPaths().web.public,
              force
          ),
    },
    {
      title: `Updating ${getPaths().web.src}/index.html`,
      task: () => updateIndex(INDEX_PATH),
    },
    {
      title: 'One more thing...',
      task: (_ctx: unknown, task: unknown) => {
        task.title = `One more thing...\n
          ${c.green(
            'Quick link to some seriously helping post for a first timer:'
        )}\n
          ${chalk.hex('#e8e8e8')(
            'https://gomakethings.com/writing-your-first-service-worker-with-vanilla-js/'
        )}`
      },
    },
  ])

  try {
    await tasks.run()
  } catch (e) {
    console.log(c.error(e.message))
  }
}
