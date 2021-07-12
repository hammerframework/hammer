#!/usr/bin/env node
/* eslint-env node */

import { copyFrameworkFilesToProject } from './lib/project.mjs'

const projectPath = process.argv?.[2] ?? process.env.RWJS_CWD
if (!projectPath) {
  console.log('Error: Please specify the path to your Redwood Project')
  console.log(`Usage: ${process.argv?.[1]} /path/to/rwjs/proect`)
  process.exit(1)
}

try {
  copyFrameworkFilesToProject(projectPath)
} catch (e) {
  console.error('Error:', e.message)
  process.exit(1)
}
