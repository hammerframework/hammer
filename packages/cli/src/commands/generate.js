import execa from 'execa'
import terminalLink from 'terminal-link'

import { getProject } from '@redwoodjs/structure'

export const command = 'generate <type>'
export const aliases = ['g']
export const description = 'Generate boilerplate code and type definitions'

export const builder = (yargs) =>
  yargs
    .command('types', 'Generate supplementary code', {}, () => {
      execa.sync('yarn rw-gen', { shell: true, stdio: 'inherit' })
    })
    .commandDir('./generate', { recurse: true })
    .demandCommand()
    .epilogue(
      `Also see the ${terminalLink(
        'Redwood CLI Reference',
        'https://redwoodjs.com/reference/command-line-interface#generate-alias-g'
      )}`
    )

/** @type {Record<string, import('yargs').Options>} */
export const yargsDefaults = {
  force: {
    alias: 'f',
    default: false,
    description: 'Overwrite existing files',
    type: 'boolean',
  },
  typescript: {
    alias: 'ts',
    default: getProject().isTypeScriptProject,
    description: 'Generate TypeScript files',
    type: 'boolean',
  },
}
