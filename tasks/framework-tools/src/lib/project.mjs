/* eslint-env node */

import fs from 'fs'
import path from 'path'

import execa from 'execa'
import ora from 'ora'
import rimraf from 'rimraf'
import terminalLink from 'terminal-link'

import {
  frameworkDependencies,
  frameworkPkgJsonFiles,
  frameworkPackagesFiles,
  frameworkPackagesBins,
  REDWOOD_PACKAGES_PATH,
} from './framework.mjs'

/**
 * Sets binaries as executable and creates symlinks to `node_modules/.bin` if they do not exist.
 */
export function fixProjectBinaries(projectPath) {
  const bins = frameworkPackagesBins()
  for (let [binName, binPath] of Object.entries(bins)) {
    // if the binPath doesn't exist, create it.
    const binSymlink = path.join(projectPath, 'node_modules/.bin', binName)
    binPath = path.join(projectPath, 'node_modules', binPath)
    if (!fs.existsSync(binSymlink)) {
      fs.mkdirSync(path.dirname(binSymlink), {
        recursive: true,
      })
      fs.symlinkSync(binPath, binSymlink)
    }
    console.log('chmod +x', terminalLink(binName, binPath))
    fs.chmodSync(binPath, '755')
  }
}

/**
 * Append all the `@redwoodjs` dependencies to the root `package.json` in a Redwood Project.
 */
export function addDependenciesToPackageJson(
  packageJsonPath,
  dependencenies = frameworkDependencies()
) {
  if (!fs.existsSync(packageJsonPath)) {
    console.log(
      `Error: The package.json path: ${packageJsonPath} does not exist.`
    )
    process.exit(1)
  }

  const packageJsonLink = terminalLink(
    'package.json',
    'file://' + packageJsonPath
  )

  const numOfDeps = Object.keys(dependencenies).length

  const spinner = ora(
    `Adding ${numOfDeps} framework dependencies to ${packageJsonLink}...`
  ).start()

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
  packageJson.dependencies = {
    ...(packageJson.dependencies || {}),
    ...dependencenies,
  }
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, undefined, 2))
  spinner.succeed(
    `Added ${numOfDeps} framework dependencies to ${packageJsonLink}`
  )
}

export function installProjectPackages(projectPath) {
  const spinner = ora("Running 'yarn install'...")
  spinner.start()
  try {
    execa.sync('yarn install', {
      cwd: projectPath,
      shell: true,
    })
    spinner.succeed("Ran 'yarn install'")
  } catch (e) {
    spinner.warn(
      `Error running 'yarn install', check ${terminalLink(
        'yarn-error.log',
        'file://' + path.join(projectPath, 'yarn-error.log')
      )} for more information.`
    )
    console.log('-'.repeat(80))
  }
}

export function copyFrameworkFilesToProject(
  projectPath,
  packages = frameworkPkgJsonFiles()
) {
  // Loop over every package, delete all existing files, copy over the new files,
  // and fix binaries.
  packages = frameworkPackagesFiles(packages)
  for (const [packageName, files] of Object.entries(packages)) {
    const packageDstPath = path.join(projectPath, 'node_modules', packageName)
    console.log(
      terminalLink(packageName, 'file://' + packageDstPath),
      files.length,
      'files'
    )
    rimraf.sync(packageDstPath)

    for (const file of files) {
      const src = path.join(
        REDWOOD_PACKAGES_PATH,
        packageName.replace('@redwoodjs', ''),
        file
      )
      const dst = path.join(packageDstPath, file)
      fs.mkdirSync(path.dirname(dst), { recursive: true })
      fs.copyFileSync(src, dst)
    }
  }

  console.log()
  fixProjectBinaries(projectPath)
}
