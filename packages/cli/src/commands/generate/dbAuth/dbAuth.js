import fs from 'fs'
import path from 'path'

import Listr from 'listr'

import {
  addRoutesToRouterTask,
  addScaffoldImport,
  generateTemplate,
  getPaths,
  transformTSToJS,
  writeFilesTask,
} from '../../../lib'
import c from '../../../lib/colors'
import { templateForComponentFile } from '../helpers'

const ROUTES = [
  `<Route path="/login" page={LoginPage} name="login" />`,
  `<Route path="/signup" page={SignupPage} name="signup" />`,
]

export const files = ({ _tests, typescript }) => {
  const files = []

  files.push(
    templateForComponentFile({
      name: 'Login',
      suffix: 'Page',
      extension: typescript ? '.tsx' : '.js',
      webPathSection: 'pages',
      generator: 'dbAuth',
      templatePath: 'login.tsx.template',
    })
  )

  files.push(
    templateForComponentFile({
      name: 'Signup',
      suffix: 'Page',
      extension: typescript ? '.tsx' : '.js',
      webPathSection: 'pages',
      generator: 'dbAuth',
      templatePath: 'signup.tsx.template',
    })
  )

  // add scaffold CSS file if it doesn't exist already
  const scaffoldOutputPath = path.join(getPaths().web.src, 'scaffold.css')
  if (!fs.existsSync(scaffoldOutputPath)) {
    const scaffoldTemplate = generateTemplate(
      path.join('scaffold', 'templates', 'assets', 'scaffold.css.template'),
      { name: 'scaffold' }
    )

    files.push([scaffoldOutputPath, scaffoldTemplate])
  }

  return files.reduce((acc, [outputPath, content]) => {
    let template = content

    if (outputPath.match(/\.[jt]sx?/) && !typescript) {
      template = transformTSToJS(outputPath, content)
    }

    return {
      [outputPath]: template,
      ...acc,
    }
  }, {})
}

const tasks = ({ force, tests, typescript }) => {
  return new Listr(
    [
      {
        title: 'Creating login & signup pages...',
        task: async () => {
          return writeFilesTask(files({ tests, typescript }), {
            overwriteExisting: force,
          })
        },
      },
      {
        title: 'Adding routes...',
        task: async () => {
          addRoutesToRouterTask(ROUTES)
        },
      },
      {
        title: 'Adding scaffold import...',
        task: () => addScaffoldImport(),
      },
      {
        title: 'One more thing...',
        task: (ctx, task) => {
          task.title =
            `One more thing...\n\n` +
            `   ${c.warning("Pages created! But you're not done yet:")}\n\n` +
            `   You'll need to tell your pages where to redirect after a user has logged in\n` +
            `   or signed up. Look in LoginPage and SignupPage for these lines:\n\n` +
            `     if (isAuthenticated) {\n` +
            `       navigate(routes.home())\n` +
            `     }\n\n` +
            `   and change the route to where you want them to go.\n\n` +
            `   Oh, and if you haven't already, add the necessary dbAuth functions and\n` +
            `   app setup by running:\n\n` +
            `     yarn rw setup auth dbAuth\n\n` +
            `   Happy authenticating!\n`
        },
      },
    ],
    { collapse: false, exitOnError: true }
  )
}

export const handler = async ({ force, tests, typescript }) => {
  const t = tasks({ force, tests, typescript })

  try {
    await t.run()
  } catch (e) {
    console.log(c.error(e.message))
  }
}
