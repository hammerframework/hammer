import camelcase from 'camelcase'
import Listr from 'listr'
import pascalcase from 'pascalcase'

import { deleteFilesTask, removeRoutesFromRouterTask } from 'src/lib'
import c from 'src/lib/colors'

import { pathName, splitPathAndName } from '../../generate/helpers'
import {
  files as pageFiles,
  paramVariants as templateVars,
} from '../../generate/page/page'

export const command = 'page <name> [path]'
export const description = 'Destroy a page and route component'
export const builder = (yargs) => {
  yargs.positional('name', {
    description: 'Name of the page',
    type: 'string',
  })
  yargs.positional('path', {
    description: 'URL path to the page. Defaults to name',
    type: 'string',
  })
}

export const tasks = ({ name, path, tests = true, stories = true }) => {
  let routeName = null

  if (name && name.includes(`/`)) {
    const { name: splittedName, path: splittedPath } = splitPathAndName(name)
    if (path !== '') {
      routeName = camelcase(splittedPath) + pascalcase(splittedName)
    }
  } else {
    routeName = camelcase(name)
  }
  return new Listr(
    [
      {
        title: 'Destroying page files...',
        task: async () => {
          const p = pathName(path, name)
          const f = pageFiles({
            name,
            tests,
            stories,
            path: p,
            stories: true,
            tests: true,
            ...templateVars(p),
          })
          return deleteFilesTask(f)
        },
      },
      {
        title: 'Cleaning up routes file...',
        task: async () => removeRoutesFromRouterTask([routeName]),
      },
    ],
    { collapse: false, exitOnError: true }
  )
}

export const handler = async ({ name, path }) => {
  const t = tasks({ name, path })
  try {
    await t.run()
  } catch (e) {
    console.log(c.error(e.message))
  }
}
