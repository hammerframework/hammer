/* eslint-env node */

import fs from 'fs'
import path from 'path'
import { dirname } from 'path'
import { fileURLToPath } from 'url'

import c from 'ansi-colors'
import execa from 'execa'
import fg from 'fast-glob'
import packlist from 'npm-packlist'

const __dirname = dirname(fileURLToPath(import.meta.url))
export const REDWOOD_PACKAGES_PATH = path.resolve(
  __dirname,
  '../../../../packages'
)

/**
 * A list of the `@redwoodjs` package.json files that are published to npm
 * and installed into a Redwood Project.
 */
export function frameworkPkgJsonFiles() {
  return fg.sync('**/package.json', {
    cwd: REDWOOD_PACKAGES_PATH,
    deep: 2, // Only the top-level-packages.
    ignore: ['**/node_modules/**', '**/create-redwood-app/**'],
    absolute: true,
  })
}

/**
 * The dependencenies used by `@redwoodjs` packages.
 */
export function frameworkDependencies(packages = frameworkPkgJsonFiles()) {
  const dependencies = {}

  for (const packageJsonPath of packages) {
    let packageJson
    try {
      packageJson = JSON.parse(fs.readFileSync(packageJsonPath))
    } catch (e) {
      throw new Error(
        packageJsonPath + ' is not a valid package.json file.' + e
      )
    }

    for (const [name, version] of Object.entries(
      packageJson?.dependencies ?? {}
    )) {
      // Skip `@redwoodjs/*` packages, since these are processed
      // by the workspace.
      if (!name.startsWith('@redwoodjs/')) {
        dependencies[name] = version

        // Warn if the packages are duplicated and are not the same version.
        if (dependencies[name] && dependencies[name] !== version) {
          console.warn(
            c.yellow('Warning:'),
            name,
            'dependency version mismatched, please make sure the versions are the same!'
          )
        }
      }
    }
  }
  return sortObjectKeys(dependencies)
}

/**
 * The files included in `@redwoodjs` packages.
 * Note: The packages must be built.
 */
export function frameworkPackagesFiles(packages = frameworkPkgJsonFiles()) {
  const fileList = {}
  for (const packageFile of packages) {
    let packageJson

    try {
      packageJson = JSON.parse(fs.readFileSync(packageFile))
    } catch (e) {
      throw new Error(packageFile + ' is not a valid package.json file.')
    }

    if (!packageJson.name) {
      continue
    }

    fileList[packageJson.name] = packlist.sync({
      path: path.dirname(packageFile),
    })
  }
  return fileList
}

/**
 * Returns execute files for `@redwoodjs` packages.
 **/
export function frameworkPackagesBins(packages = frameworkPkgJsonFiles()) {
  let bins = {}
  for (const packageFile of packages) {
    let packageJson

    try {
      packageJson = JSON.parse(fs.readFileSync(packageFile))
    } catch (e) {
      throw new Error(packageFile + ' is not a valid package.json file.')
    }

    if (!packageJson.name) {
      continue
    }

    if (!packageJson.bin) {
      continue
    }
    for (const [binName, binPath] of Object.entries(packageJson.bin)) {
      bins[binName] = path.join(packageJson.name, binPath)
    }
  }
  return bins
}

/**
 * Determine base package directory for any filename in it's path.
 **/
export function resolvePackageJsonPath(filePath) {
  // Do we want the package name?
  const packageName = filePath
    .replace(REDWOOD_PACKAGES_PATH, '')
    .split(path.sep)[1]
  return path.join(REDWOOD_PACKAGES_PATH, packageName, 'package.json')
}

export function packageJsonName(packageJsonPath) {
  return JSON.parse(fs.readFileSync(packageJsonPath), 'utf-8').name
}

/**
 * Build Redwood packages.
 */
export function buildPackages(packages = frameworkPkgJsonFiles()) {
  const packageNames = packages.map(packageJsonName)

  execa.sync(
    'yarn lerna run build',
    ['--parallel', `--scope={${packageNames.join(',') + ','}}`],
    {
      shell: true,
      stdio: 'inherit',
      cwd: path.resolve(__dirname, '../../'),
    }
  )
}

function sortObjectKeys(obj) {
  return Object.keys(obj)
    .sort()
    .reduce((acc, key) => {
      acc[key] = obj[key]
      return acc
    }, {})
}
