import Listr from 'listr'
import pascalcase from 'pascalcase'
import pluralize from 'pluralize'

import {
  deleteFilesTask,
  getPaths,
  readFile,
  removeRoutesFromRouterTask,
  writeFile,
} from 'src/lib'
import c from 'src/lib/colors'

import { splitPathAndName } from '../../generate/helpers'
import {
  files,
  routes as scaffoldRoutes,
} from '../../generate/scaffold/scaffold'

export const command = 'scaffold <model>'
export const description =
  'Destroy pages, SDL, and Services files based on a given DB schema Model'

const removeRoutesWithSet = async (model, path) => {
  const routes = await scaffoldRoutes({ model, path })
  const routeNames = routes.map(extractRouteName)
  const pluralPascalName = pascalcase(pluralize(model))
  const layoutName = `${pluralPascalName}Layout`
  return removeRoutesFromRouterTask(routeNames, layoutName)
}

const removeSetImport = () => {
  const routesPath = getPaths().web.routes
  const routesContent = readFile(routesPath).toString()
  if (routesContent.match('<Set')) {
    return 'Skipping removal of Set import in Routes.{js,tsx}'
  }

  const [redwoodRouterImport] = routesContent.match(
    /import {[^]*} from '@redwoodjs\/router'/
  )
  const removedSetImport = redwoodRouterImport.replace(/,*\s*Set,*/, '')
  const newRoutesContent = routesContent.replace(
    redwoodRouterImport,
    removedSetImport
  )
  writeFile(routesPath, newRoutesContent, { overwriteExisting: true })

  return 'Removed Set import in Routes.{js,tsx}'
}

const removeLayoutImport = ({ model: name, path: scaffoldPath = '' }) => {
  const pluralPascalName = pascalcase(pluralize(name))
  const pascalScaffoldPath =
    scaffoldPath === ''
      ? scaffoldPath
      : scaffoldPath.split('/').map(pascalcase).join('/') + '/'
  const layoutName = `${pluralPascalName}Layout`
  const importLayout = `import ${pluralPascalName}Layout from 'src/layouts/${pascalScaffoldPath}${layoutName}'`
  const routesPath = getPaths().web.routes
  const routesContent = readFile(routesPath).toString()

  const newRoutesContent = routesContent.replace(
    new RegExp(`\\s*${importLayout}`),
    ''
  )
  writeFile(routesPath, newRoutesContent, { overwriteExisting: true })

  return 'Removed layout import from Routes.{js,tsx}'
}

export const builder = (yargs) => {
  yargs.positional('model', {
    description: 'Model to destroy the scaffold of',
    type: 'string',
  })
}

export const tasks = ({ model, path }) =>
  new Listr(
    [
      {
        title: 'Destroying scaffold files...',
        task: async () => {
          const f = await files({ model, path })
          return deleteFilesTask(f)
        },
      },
      {
        title: 'Cleaning up scaffold routes...',
        task: async () => removeRoutesWithSet(model, path),
      },
      {
        title: 'Removing set import...',
        task: () => removeSetImport(),
      },
      {
        title: 'Removing layout import...',
        task: () => removeLayoutImport({ model, path }),
      },
    ],
    { collapse: false, exitOnError: true }
  )

export const handler = async ({ model: modelArg }) => {
  const { name, path } = splitPathAndName(modelArg)

  const t = tasks({ model: name, path })
  try {
    await t.run()
  } catch (e) {
    console.log(c.error(e.message))
  }
}

const extractRouteName = (route) => {
  const { groups } = route.match(/.*name="?(?<routeName>\w+)"?/)
  return groups.routeName
}
