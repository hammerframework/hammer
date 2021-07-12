#!/usr/bin/env node
/* eslint-env node */

import fs from 'fs'
import path from 'path'

import c from 'ansi-colors'
import chokidar from 'chokidar'

import {
  REDWOOD_PACKAGES_PATH,
  packageJsonName,
  resolvePackageJsonPath,
  buildPackages,
} from './lib/framework.mjs'
import {
  installProjectPackages,
  addDependenciesToPackageJson,
  copyFrameworkFilesToProject,
} from './lib/project.mjs'

const projectPath = process.argv?.[2] ?? process.env.RWJS_CWD
if (!projectPath) {
  console.log('Error: Please specify the path to your Redwood Project')
  console.log(`Usage: ${process.argv?.[1]} /path/to/rwjs/proect`)
  process.exit(1)
}

// Cache the original package.json and restore it when this process exits.
const projectPackageJsonPath = path.join(projectPath, 'package.json')
const projectPackageJson = fs.readFileSync(projectPackageJsonPath, 'utf-8')
process.on('SIGINT', () => {
  console.log()
  console.log(`Removing framework packages from 'package.json'...`)
  fs.writeFileSync(projectPackageJsonPath, projectPackageJson)
  // TODO: Delete `node_modules/@redwoodjs`
  console.log("...Done. Run 'yarn install'")
  process.exit(0)
})

function logStatus(m) {
  console.log(c.bgYellow(c.black('rwfw ')), c.yellow(m))
}

chokidar
  .watch(REDWOOD_PACKAGES_PATH, {
    ignoreInitial: true,
    persistent: true,
    awaitWriteFinish: true,
    ignored: (file) =>
      file.includes('/node_modules/') ||
      file.includes('/dist/') ||
      file.includes('/__tests__/') ||
      file.includes('/__fixtures__/') ||
      file.includes('/.test./') ||
      ['.DS_Store'].some((ext) => file.endsWith(ext)),
  })
  .on('ready', async () => {
    logStatus('Building Framework...')
    buildPackages()

    console.log()
    logStatus('Adding dependencies...')
    addDependenciesToPackageJson(projectPackageJsonPath)
    installProjectPackages(projectPath)

    console.log()
    logStatus('Copying files...')
    copyFrameworkFilesToProject(projectPath)

    console.log()
    logStatus('Done, and waiting for changes...')
    console.log('-'.repeat(80))
  })
  .on('all', (_event, filePath) => {
    logStatus(filePath)

    if (filePath.endsWith('package.json')) {
      logStatus(
        `${c.red(
          'Warning:'
        )} You modified a package.json file. If you've modified the ${c.underline(
          'dependencies'
        )}, then you must run ${c.underline('yarn rwfw project:sync')} again.`
      )
    }

    const packageJsonPath = resolvePackageJsonPath(filePath)
    const packageName = packageJsonName(packageJsonPath)
    logStatus(c.magenta(packageName))

    console.log()
    logStatus(`Building ${packageName}...`)
    buildPackages([packageJsonPath])

    console.log()
    logStatus(`Copying ${packageName}...`)
    copyFrameworkFilesToProject(projectPath, [packageJsonPath])

    console.log()
    logStatus(`Done, and waiting for changes...`)
    console.log('-'.repeat(80))
  })
