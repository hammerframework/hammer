#!/usr/bin/env node
import fs from 'fs'
import path from 'path'

import boxen from 'boxen'
import chokidar from 'chokidar'
import execa from 'execa'
import _, { omit } from 'lodash'
import prettier from 'prettier'
import rimraf from 'rimraf'
import yargs from 'yargs'

import { ensurePosixPath, getPaths } from '@redwoodjs/internal'

import c from './lib/colors'

const RW_BINS = {
  redwood: 'cli/dist/index.js',
  rw: 'cli/dist/index.js',
  'redwood-tools': 'cli/dist/redwood-tools.js',
  rwt: 'cli/dist/redwood-tools.js',
  'api-server': 'api-server/dist/index.js',
  'rw-api-server': 'api-server/dist/index.js',
  'rw-api-build': 'core/esbuild/index.js',
  'rw-gen': 'internal/dist/generate/generate.js',
  'rw-gen-watch': 'internal/dist/generate/watch.js',
}

export const resolveFrameworkPath = (RW_PATH) => {
  if (!fs.existsSync(RW_PATH)) {
    console.error(`Error: '${RW_PATH}' does not exist`)
    process.exit(1)
  }
  return path.resolve(process.cwd(), RW_PATH)
}

export const fixBinaryPermissions = (PROJECT_PATH) => {
  Object.keys(RW_BINS)
    .map((name) => {
      return path.join(PROJECT_PATH, 'node_modules/.bin/', name)
    })
    .forEach((binFile) => {
      try {
        fs.chmodSync(binFile, '755')
      } catch (e) {
        console.warn(`Warning: Could not chmod ${binFile}`)
        console.log(e)
      }
    })
}

export const fixProjectBinaries = (PROJECT_PATH) => {
  Object.keys(RW_BINS)
    .map((name) => {
      const from = path.join(PROJECT_PATH, 'node_modules/.bin/', name)
      const to = path.join(
        PROJECT_PATH,
        'node_modules/@redwoodjs',
        RW_BINS[name]
      )
      console.log(`symlink '${from}' -> '${to}'`)
      return [from, to]
    })
    .forEach(([from, to]) => {
      try {
        fs.unlinkSync(from)
      } catch (e) {
        console.warn(`Warning: Could not unlink ${from}`)
      }
      try {
        fs.symlinkSync(to, from)
      } catch (e) {
        console.warn(`Warning: Could not symlink ${from} -> ${to}`)
        console.log(e)
      }
      try {
        fs.chmodSync(from, '755')
      } catch (e) {
        console.warn(`Warning: Could not chmod ${from}`)
        console.log(e)
      }
    })
}

export const copyFiles = async (src, dest) => {
  // TODO: Figure out if we need to only run based on certain events.

  src = ensurePosixPath(src)
  dest = ensurePosixPath(dest)

  await execa(
    'rsync',
    [
      `-rtvu --delete --exclude "create-redwood-app/template"`,
      `'${src}'`,
      `'${dest}'`,
    ],
    {
      shell: true,
      stdio: 'inherit',
      cleanup: true,
    }
  )
  // when rsync is run modify the permission to make binaries executable.
  fixProjectBinaries(getPaths().base)
}

const rwtCopy = ({ RW_PATH = process.env.RW_PATH }) => {
  RW_PATH = resolveFrameworkPath(RW_PATH)

  console.log(`Redwood Framework Path: ${c.info(RW_PATH)}`)

  const src = `${RW_PATH}/packages/`
  const dest = `${getPaths().base}/node_modules/@redwoodjs/` // eslint-disable-line

  copyFiles(src, dest)
}

const rwtCopyWatch = ({ RW_PATH = process.env.RW_PATH }) => {
  RW_PATH = resolveFrameworkPath(RW_PATH)

  console.log(`Redwood Framework Path: ${c.info(RW_PATH)}`)

  const src = `${RW_PATH}/packages/`
  const dest = `${getPaths().base}/node_modules/@redwoodjs/`

  chokidar
    .watch(src, {
      persistent: true,
      recursive: true,
      ignored: [path.join(src, 'packages/create-redwood-app/template')],
    })
    .on(
      'all',
      _.debounce((event) => {
        // TODO: Figure out if we need to only run based on certain events.
        console.log('Trigger event: ', event)
        copyFiles(src, dest)
      }, 500)
    )
}

const rwtLink = async (yargs) => {
  const RW_PATH = yargs.RW_PATH || process.env.RW_PATH
  const { clean, watch, only } = yargs

  if (!RW_PATH) {
    console.error(c.error('You must specify a path to your local redwood repo'))
    console.error(c.error("Or set RW_PATH in your shell's environment"))
    process.exit(1)
    return
  }

  const frameworkPath = resolveFrameworkPath(RW_PATH)

  console.log(`\n Redwood Framework Path: ${c.info(frameworkPath)}`)

  const frameworkPackagesPath = path.join(frameworkPath, 'packages/')
  const projectPackagesPath = path.join(
    getPaths().base,
    'node_modules/_redwood-linked-packages'
  )

  console.log(
    `Copying your local Redwood build from ${c.info(frameworkPackagesPath)} \n`
  )

  if (!fs.existsSync(projectPackagesPath)) {
    fs.mkdirSync(projectPackagesPath)
  }

  updateProjectWithResolutions(frameworkPackagesPath)

  if (clean) {
    await execa('yarn build:clean', {
      shell: true,
      stdio: 'inherit',
      cleanup: true,
      cwd: frameworkPath,
    })
  }

  // Inform user to unlink framework repo, when process cancelled
  process.on('SIGINT', () => {
    const message = `
    🙏  Thanks for contributing..\n
    Please run ${c.green('yarn rwt unlink')} to restore your project
    `
    console.log(
      boxen(message, {
        padding: { top: 0, bottom: 0, right: 1, left: 1 },
        margin: 1,
        borderColour: 'gray',
      })
    )
  })

  const onlyParams = only ? ['--only', only] : []

  await execa(
    'node ./tasks/build-and-copy',
    ['--dest', `"${projectPackagesPath}"`, ...onlyParams],
    {
      shell: true,
      stdio: 'inherit',
      cleanup: true,
      cwd: frameworkPath,
    }
  )

  // Delete existing redwood folders in node_modules
  // Do this right before install, incase build:link fails
  rimraf.sync(path.join(getPaths().base, 'node_modules/@redwoodjs/'))

  // Let workspaces do the link
  await execa('yarn install', ['--pure-lockfile', '--check-files'], {
    shell: true,
    stdio: 'inherit',
    cleanup: true,
    cwd: getPaths().base,
  })

  fixBinaryPermissions(getPaths().base)

  const message = `
  ${c.bold('🚀 Go Forth and Contribute!')}\n
  🔗  Your project is linked!\n
  Contributing doc: ${c.underline('https://redwoodjs.com/docs/contributing')}
  `
  console.log(
    boxen(message, {
      padding: { top: 0, bottom: 0, right: 1, left: 1 },
      margin: 1,
      borderColour: 'gray',
    })
  )

  if (watch) {
    // Restart build:link scripts in watchmode
    execa(
      'yarn build:link',
      ['--dest', `"${projectPackagesPath}"`, '--watch', ...onlyParams],
      {
        shell: true,
        stdio: 'inherit',
        cleanup: true,
        cwd: frameworkPath,
      }
    )
  }
}

// This should be synchronous
const rwtUnlink = () => {
  const linkedPackagesPath = path.join(
    getPaths().base,
    'node_modules/_redwood-linked-packages'
  )
  if (fs.existsSync(linkedPackagesPath)) {
    // remove resolutions we added in link
    updateProjectWithResolutions(linkedPackagesPath, true)

    rimraf.sync(path.join(getPaths().base, 'node_modules/@redwoodjs'))

    rimraf.sync(linkedPackagesPath)
  }

  execa.sync('yarn install', ['--check-files'], {
    shell: true,
    stdio: 'inherit',
    cleanup: true,
    cwd: getPaths().base,
  })

  return process.exit(0)
}

const rwtInstall = ({ packageName }) => {
  // This command upgrades a Redwood package from the local NPM registry. You
  // run the local registry from `./tasks/run-local-npm`.
  // See `CONTRIBUTING.md` for more information.
  const pkgPath = path.join(getPaths().base, 'node_modules', packageName)
  console.log(`Deleting ${pkgPath}`)
  try {
    fs.rmdirSync(pkgPath, { recursive: true })
  } catch (e) {
    console.error(`Error: Could not delete ${pkgPath}`)
    process.exit(1)
  }

  execa(
    'yarn',
    [
      'upgrade',
      `${packageName}@dev`,
      '--no-lockfile',
      '--registry http://localhost:4873/',
      '--check-files',
    ],
    {
      shell: true,
      cwd: getPaths().base,
      stdio: 'inherit',
      extendEnv: true,
      cleanup: true,
    }
  )
}

const getRwPackagesToLink = (packagesPath) => {
  const packageFolders = fs.readdirSync(packagesPath)

  return packageFolders
    .filter((folderName) => folderName !== 'create-redwood-app')
    .filter((item) => !/(^|\/)\.[^\/\.]/g.test(item)) // filter hidden files
    .map((packageFolder) => {
      return `@redwoodjs/${packageFolder}`
    })
}

const updateProjectWithResolutions = (redwoodPackagesPath, remove) => {
  const pkgJSONPath = path.join(getPaths().base, 'package.json')
  const packageJSON = require(pkgJSONPath)

  const frameworkVersion = require(path.join(
    redwoodPackagesPath,
    'cli/package.json'
  )).version

  const frameworkRepoResolutions = getRwPackagesToLink(
    redwoodPackagesPath
  ).reduce((resolutions, packageName) => {
    resolutions[packageName] = frameworkVersion
    return resolutions
  }, {})

  let resolutions = packageJSON.resolutions
  let packages = packageJSON.workspaces.packages

  if (remove) {
    resolutions = omit(resolutions, Object.keys(frameworkRepoResolutions))
    packages = packages.filter(
      (workspaceFolder) =>
        workspaceFolder !== 'node_modules/_redwood-linked-packages/*'
    )
  } else {
    resolutions = {
      ...resolutions,
      ...frameworkRepoResolutions,
    }
    if (!packages.includes('node_modules/_redwood-linked-packages/*')) {
      packages.push('node_modules/_redwood-linked-packages/*')
    }
  }

  const updatedPackageJSON = {
    ...packageJSON,
    workspaces: {
      packages,
    },
    resolutions,
  }

  fs.writeFileSync(
    pkgJSONPath,
    prettier.format(JSON.stringify(updatedPackageJSON), {
      parser: 'json-stringify',
    })
  )
}

// eslint-disable-next-line no-unused-expressions
yargs
  .command(
    ['copy [RW_PATH]', 'cp'],
    'Copy the Redwood Framework path to this project',
    {},
    rwtCopy
  )
  .command(
    ['copy:watch [RW_PATH]', 'cpw'],
    'Watch the Redwood Framework path for changes and copy them over to this project',
    {},
    rwtCopyWatch
  )
  .command({
    command: 'link [RW_PATH]',
    aliases: ['l'],
    builder: (yargs) => {
      return yargs
        .option('clean', {
          alias: 'c',
          type: 'boolean',
          description: 'Clean the redwood dist folders first.',
          default: true,
        })
        .option('watch', {
          alias: 'w',
          type: 'boolean',
          description: 'Build and watch the supplied redwood repo',
          default: true,
        })
        .option('only', {
          alias: 'only',
          type: 'string',
          description: 'Specify folder to link from RW_PATH/packages',
        })
    },
    desc: 'Run your local version of redwood in this project',
    handler: rwtLink,
  })
  .command({
    command: 'unlink',
    desc: 'Unlink your local version of redwood, and use the one specified in package.json',
    handler: rwtUnlink,
  })
  .command(
    ['install [packageName]', 'i'],
    'Install a package from your local NPM registry',
    () => {},
    rwtInstall
  )
  .command(
    ['fix-bins', 'fix'],
    'Fix Redwood symlinks and permissions',
    {},
    () => {
      fixProjectBinaries(getPaths().base)
    }
  )
  .demandCommand()
  .strict().argv
