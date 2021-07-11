export const command = 'data-migrate <command>'
export const aliases = ['dm']
export const description = 'Migrate the data in your database'
import terminalLink from 'terminal-link'

export const builder = (yargs) =>
  yargs
    .commandDir('./dataMigrate')
    .demandCommand()
    .epilogue(
      `Also see the ${terminalLink(
        'Redwood CLI Reference',
        'https://redwoodjs.com/reference/command-line-interface#dataMigrate'
      )}`
    )
