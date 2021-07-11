import fs from 'fs'
import path from 'path'

import execa from 'execa'
import Listr from 'listr'
import prompts from 'prompts'
import terminalLink from 'terminal-link'

import { resolveFile } from '@redwoodjs/internal'
import { getProject } from '@redwoodjs/structure'

import { getPaths, writeFilesTask } from 'src/lib'
import c from 'src/lib/colors'
const AUTH_PROVIDER_IMPORT = `import { AuthProvider } from '@redwoodjs/auth'`

const OUTPUT_PATHS = {
  auth: path.join(
    getPaths().api.lib,
    getProject().isTypeScriptProject ? 'auth.ts' : 'auth.js'
  ),
  function: path.join(
    getPaths().api.functions,
    getProject().isTypeScriptProject ? 'auth.ts' : 'auth.js'
  ),
}

const getGraphqlPath = () =>
  resolveFile(path.join(getPaths().api.functions, 'graphql'))

const getWebAppPath = () => getPaths().web.app

const getSupportedProviders = () =>
  fs
    .readdirSync(path.resolve(__dirname, 'providers'))
    .map((file) => path.basename(file, '.js'))
    .filter((file) => file !== 'README.md')

const getTemplates = () =>
  fs
    .readdirSync(path.resolve(__dirname, 'templates'))
    .reduce((templates, file) => {
      if (file === 'auth.js.template') {
        return {
          ...templates,
          base: [path.resolve(__dirname, 'templates', file)],
        }
      } else {
        const provider = file.split('.')[0]
        if (templates[provider]) {
          templates[provider].push(path.resolve(__dirname, 'templates', file))
          return { ...templates }
        } else {
          return {
            ...templates,
            [provider]: [path.resolve(__dirname, 'templates', file)],
          }
        }
      }
    }, {})

// returns the content of App.{js,tsx} with import statements added
const addWebImports = (content, imports) => {
  return `${AUTH_PROVIDER_IMPORT}\n` + imports.join('\n') + '\n' + content
}

// returns the content of App.{js,tsx} with init lines added (if there are any)
const addWebInit = (content, init) => {
  if (init) {
    return content.replace(
      'const App = () => (',
      `${init}\n\nconst App = () => (`
    )
  } else {
    return content
  }
}

const objectToComponentProps = (obj, options = { exclude: [] }) => {
  let props = []

  for (const [key, value] of Object.entries(obj)) {
    if (!options.exclude.includes(key)) {
      if (key === 'client') {
        props.push(`${key}={${value}}`)
      } else {
        props.push(`${key}="${value}"`)
      }
    }
  }

  return props
}

// returns the content of App.{js,tsx} with <AuthProvider> added
const addWebRender = (content, authProvider) => {
  const [_, indent, redwoodApolloProvider] = content.match(
    /(\s+)(<RedwoodApolloProvider>.*<\/RedwoodApolloProvider>)/s
  )

  const redwoodApolloProviderLines = redwoodApolloProvider
    .split('\n')
    .map((line) => {
      return '  ' + line
    })

  const customRenderOpen = (authProvider.render || []).reduce(
    (acc, component) => acc + indent + `<${component}>`,
    ''
  )

  const customRenderClose = (authProvider.render || []).reduce(
    (acc, component) => indent + `</${component}>` + acc,
    ''
  )

  const props = objectToComponentProps(authProvider, { exclude: ['render'] })

  const renderContent =
    customRenderOpen +
    indent +
    `<AuthProvider ${props.join(' ')}>` +
    indent +
    redwoodApolloProviderLines.join('\n') +
    indent +
    `</AuthProvider>` +
    customRenderClose

  return content.replace(
    /\s+<RedwoodApolloProvider>.*<\/RedwoodApolloProvider>/s,
    renderContent
  )
}

// returns the content of App.{js,tsx} with <AuthProvider> updated
const updateWebRender = (content, authProvider) => {
  const props = objectToComponentProps(authProvider)
  const renderContent = `<AuthProvider ${props.join(' ')}>`

  return content.replace(/<AuthProvider client={.*} type=".*">/s, renderContent)
}

// returns the content of App.{js,tsx} without the old auth import
const removeOldWebImports = (content, imports) => {
  return content.replace(`${AUTH_PROVIDER_IMPORT}\n` + imports.join('\n'), '')
}

// returns the content of App.{js,tsx} without the old auth init
const removeOldWebInit = (content, init) => {
  return content.replace(init, '')
}

// returns content with old auth provider removes
const removeOldAuthProvider = async (content) => {
  // get the current auth provider
  const [_, currentAuthProvider] = content.match(
    /<AuthProvider.*type=['"](.*)['"]/s
  )

  let oldAuthProvider
  try {
    oldAuthProvider = await import(`./providers/${currentAuthProvider}`)
  } catch (e) {
    throw new Error('Could not replace existing auth provider init')
  }

  content = removeOldWebImports(content, oldAuthProvider.config.imports)
  content = removeOldWebInit(content, oldAuthProvider.config.init)

  return content
}

// check to make sure AuthProvider doesn't exist
const checkAuthProviderExists = async () => {
  const content = fs.readFileSync(getWebAppPath()).toString()

  if (content.includes(AUTH_PROVIDER_IMPORT)) {
    throw new Error(
      'Existing auth provider found.\nUse --force to override existing provider.'
    )
  }
}

// the files to create to support auth
export const files = (provider) => {
  const templates = getTemplates()
  let files = {}

  // look for any templates for this provider
  for (const [templateProvider, templateFiles] of Object.entries(templates)) {
    if (provider === templateProvider) {
      templateFiles.forEach((templateFile) => {
        const outputPath =
          OUTPUT_PATHS[path.basename(templateFile).split('.')[1]]
        files = Object.assign(files, {
          [outputPath]: fs.readFileSync(templateFile).toString(),
        })
      })
    }
  }

  // if there are no provider-specific templates, just use the base auth one
  if (Object.keys(files).length === 0) {
    files = {
      [OUTPUT_PATHS.auth]: fs.readFileSync(templates.base[0]).toString(),
    }
  }

  return files
}

// actually inserts the required config lines into App.{js,tsx}
export const addConfigToApp = async (config, force) => {
  const webAppPath = getWebAppPath()

  let content = fs.readFileSync(webAppPath).toString()

  // update existing AuthProvider if --force else add new AuthProvider
  if (content.includes(AUTH_PROVIDER_IMPORT) && force) {
    content = await removeOldAuthProvider(content)
    content = updateWebRender(content, config.authProvider)
  } else {
    content = addWebRender(content, config.authProvider)
  }

  content = addWebImports(content, config.imports)
  content = addWebInit(content, config.init)

  fs.writeFileSync(webAppPath, content)
}

export const addApiConfig = () => {
  const graphqlPath = getGraphqlPath()

  let content = fs.readFileSync(graphqlPath).toString()

  // default to an array to avoid destructure errors
  const [_, hasAuthImport] =
    content.match(/(import {.*} from 'src\/lib\/auth.*')/s) || []

  if (!hasAuthImport) {
    // add import statement
    content = content.replace(
      /^(.*services.*)$/m,
      `$1\n\nimport { getCurrentUser } from 'src/lib/auth'`
    )
    // add object to handler
    content = content.replace(
      /^(\s*)(schema: makeMergedSchema)(.*)$/m,
      `$1getCurrentUser,\n$1$2$3`
    )
    fs.writeFileSync(graphqlPath, content)
  }
}

export const isProviderSupported = (provider) => {
  return getSupportedProviders().indexOf(provider) !== -1
}

export const apiSrcDoesExist = () => {
  return fs.existsSync(path.join(getPaths().api.src))
}

export const webIndexDoesExist = () => {
  return fs.existsSync(getWebAppPath())
}

export const graphFunctionDoesExist = () => {
  return fs.existsSync(getGraphqlPath())
}

export const command = 'auth <provider>'
export const description = 'Generate an auth configuration'
export const builder = (yargs) => {
  yargs
    .positional('provider', {
      choices: getSupportedProviders(),
      description: 'Auth provider to configure',
      type: 'string',
    })
    .option('force', {
      alias: 'f',
      default: false,
      description: 'Overwrite existing configuration',
      type: 'boolean',
    })
    .epilogue(
      `Also see the ${terminalLink(
        'Redwood CLI Reference',
        'https://redwoodjs.com/reference/command-line-interface#generate-auth'
      )}`
    )
}

export const handler = async ({ provider, force }) => {
  const providerData = await import(`./providers/${provider}`)

  // check if api/src/lib/auth.js already exists and if so, ask the user to overwrite
  if (force === false) {
    if (fs.existsSync(Object.keys(files(provider))[0])) {
      const response = await prompts({
        type: 'confirm',
        name: 'answer',
        message: `Overwrite existing ${getPaths().api.lib.replace(
          getPaths().base,
          ''
        )}/auth.[jt]s?`,
        initial: false,
      })
      force = response.answer
    }
  }

  const tasks = new Listr(
    [
      {
        title: 'Generating auth lib...',
        task: (_ctx, task) => {
          if (apiSrcDoesExist()) {
            return writeFilesTask(files(provider), {
              overwriteExisting: force,
            })
          } else {
            task.skip('api/src not found, skipping')
          }
        },
      },
      {
        title: 'Adding auth config to web...',
        task: (_ctx, task) => {
          if (webIndexDoesExist()) {
            addConfigToApp(providerData.config, force)
          } else {
            task.skip('web/src/App.{js,tsx} not found, skipping')
          }
        },
      },
      {
        title: 'Adding auth config to GraphQL API...',
        task: (_ctx, task) => {
          if (graphFunctionDoesExist()) {
            addApiConfig()
          } else {
            task.skip('GraphQL function not found, skipping')
          }
        },
      },
      {
        title: 'Adding required web packages...',
        task: async () => {
          if (!isProviderSupported(provider)) {
            throw new Error(`Unknown auth provider '${provider}'`)
          }
          await execa('yarn', [
            'workspace',
            'web',
            'add',
            ...providerData.webPackages,
            '@redwoodjs/auth',
          ])
        },
      },
      providerData.apiPackages.length > 0 && {
        title: 'Adding required api packages...',
        task: async () => {
          if (!isProviderSupported(provider)) {
            throw new Error(`Unknown auth provider '${provider}'`)
          }
          await execa('yarn', [
            'workspace',
            'api',
            'add',
            ...providerData.apiPackages,
          ])
        },
      },
      {
        title: 'Installing packages...',
        task: async () => {
          await execa('yarn', ['install'])
        },
      },
      providerData.task,
      {
        title: 'One more thing...',
        task: (_ctx, task) => {
          task.title = `One more thing...\n\n   ${providerData.notes.join(
            '\n   '
          )}\n`
        },
      },
    ].filter(Boolean),
    { collapse: false }
  )

  try {
    // Don't throw existing provider error when --force exists
    if (!force) {
      await checkAuthProviderExists()
    }

    await tasks.run()
  } catch (e) {
    console.error(c.error(e.message))
    process.exit(e?.exitCode || 1)
  }
}
