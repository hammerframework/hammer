#!/usr/bin/env node
/* eslint-env node */

import path from 'path'

import { addDependenciesToPackageJson } from './lib/project.mjs'

const projectPath = process.argv?.[2] ?? process.env.RWJS_CWD
if (!projectPath) {
  console.log('Error: Please specify the path to your Redwood Project')
  console.log(`Usage: ${process.argv?.[1]} /path/to/rwjs/proect`)
  process.exit(1)
}

try {
  const packageJsonPath = path.join(projectPath, 'package.json')
  addDependenciesToPackageJson(packageJsonPath)
  console.log('Done. Now run `yarn install`.')
} catch (e) {
  console.log('Error:', e.message)
  process.exit(1)
}
