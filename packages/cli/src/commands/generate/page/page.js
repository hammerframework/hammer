import { execSync } from 'child_process'

import camelcase from 'camelcase'
import Listr from 'listr'
import { paramCase } from 'param-case'
import pascalcase from 'pascalcase'

import { getConfig } from '@redwoodjs/internal'

import { transformTSToJS } from 'src/lib'
import { addRoutesToRouterTask, writeFilesTask } from 'src/lib'
import c from 'src/lib/colors'

import {
  createYargsForComponentGeneration,
  pathName,
  templateForComponentFile,
  splitPathAndName,
  formatParamPath,
} from '../helpers'

const COMPONENT_SUFFIX = 'Page'
const REDWOOD_WEB_PATH_NAME = 'pages'

export const paramVariants = (path) => {
  const param = path?.match(/(\{[\w:]+\})/)?.[1]
  const paramName = param?.replace(/:[^}]+/, '').slice(1, -1)

  if (param === undefined) {
    return {
      propParam: '',
      propValueParam: '',
      argumentParam: '',
      paramName: '',
      paramValue: '',
      paramType: '',
    }
  }

  // set paramType param includes type (e.g. {id:Int}), else use string
  const paramType = param?.match(/:/)
    ? param?.replace(/[^:]+/, '').slice(1, -1)
    : 'string'

  // "42" is just a value used for demonstrating parameter usage in the
  // generated page-, test-, and story-files.
  return {
    propParam: `{ ${paramName} }`,
    propValueParam: `${paramName}="42" `,
    argumentParam: `{ ${paramName}: '42' }`,
    paramName,
    paramValue: '42',
    paramType,
  }
}

export const files = ({ name, tests, stories, typescript, ...rest }) => {
  const pageFile = templateForComponentFile({
    name,
    suffix: COMPONENT_SUFFIX,
    extension: typescript ? '.tsx' : '.js',
    webPathSection: REDWOOD_WEB_PATH_NAME,
    generator: 'page',
    templatePath: 'page.tsx.template',
    templateVars: rest,
  })

  const testFile = templateForComponentFile({
    name,
    suffix: COMPONENT_SUFFIX,
    extension: typescript ? '.test.tsx' : '.test.js',
    webPathSection: REDWOOD_WEB_PATH_NAME,
    generator: 'page',
    templatePath: 'test.tsx.template',
    templateVars: rest,
  })

  const storiesFile = templateForComponentFile({
    name,
    suffix: COMPONENT_SUFFIX,
    extension: typescript ? '.stories.tsx' : '.stories.js',
    webPathSection: REDWOOD_WEB_PATH_NAME,
    generator: 'page',
    templatePath: 'stories.tsx.template',
    templateVars: rest,
  })

  const files = [pageFile]

  if (tests) {
    files.push(testFile)
  }

  if (stories) {
    files.push(storiesFile)
  }

  // Returns
  // {
  //    "path/to/fileA": "<<<template>>>",
  //    "path/to/fileB": "<<<template>>>",
  // }
  return files.reduce((acc, [outputPath, content]) => {
    const template = typescript ? content : transformTSToJS(outputPath, content)

    return {
      [outputPath]: template,
      ...acc,
    }
  }, {})
}

export const routes = ({ name, path }) => {
  // handle path in the name args includes path
  if (name && name.includes('/')) {
    const { name: splittedName, path: splittedPath } = splitPathAndName(name)
    return [
      `<Route path="/${formatParamPath(splittedPath)}${paramCase(
        splittedName
      )}" page={${camelcase(pascalcase(splittedPath))}${pascalcase(
        splittedName
      )}Page} name="${camelcase(pascalcase(splittedPath))}${pascalcase(
        splittedName
      )}" />`,
    ]
  }
  return [
    `<Route path="${path}" page={${pascalcase(name)}Page} name="${camelcase(
      name
    )}" />`,
  ]
}

const positionalsObj = {
  path: {
    description: 'URL path to the page, or just {param}. Defaults to name',
    type: 'string',
  },
}

// @NOTE: Not exporting handler from function
// As pages need a special handler
export const {
  command,
  description,
  builder,
} = createYargsForComponentGeneration({
  componentName: 'page',
  filesFn: files,
  positionalsObj,
})

export const handler = async ({
  name,
  path,
  force,
  tests,
  stories,
  typescript = false,
}) => {
  if (tests === undefined) {
    tests = getConfig().generate.tests
  }
  if (stories === undefined) {
    stories = getConfig().generate.stories
  }
  if (process.platform === 'win32') {
    // running `yarn rw g page home /` on Windows using GitBash
    // POSIX-to-Windows path conversion will kick in.
    // See https://github.com/git-for-windows/build-extra/blob/d715c9e/ReleaseNotes.md
    // As a workaround we try to detect when this has happened, and reverse
    // the action

    try {
      // `cygpath -m /` will return something like 'C:/Program Files/Git/\n'
      const slashPath = execSync('cygpath -m /', {
        stdio: ['ignore', 'pipe', 'ignore'],
      })
        .toString()
        .trim()

      // `yarn rw g page home /` =>
      //   page === 'C:/Program Files/Git'
      // `yarn rw g page about /about` =>
      //   page === 'C:/Program Files/Git/about'
      // Sometimes there is a / after 'Git' to match, sometimes there isn't
      path = path.replace(new RegExp(`^${slashPath}?`), '/')
    } catch {
      // probably using PowerShell or cmd, in which case no special handling
      // is needed
    }
  }

  const tasks = new Listr(
    [
      {
        title: 'Generating page files...',
        task: async () => {
          path = pathName(path, name)
          const f = await files({
            name,
            path,
            tests,
            stories,
            typescript,
            ...paramVariants(path),
          })
          return writeFilesTask(f, { overwriteExisting: force })
        },
      },
      {
        title: 'Updating routes file...',
        task: async () => {
          addRoutesToRouterTask(routes({ name, path: pathName(path, name) }))
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
