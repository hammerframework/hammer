import path from 'path'

import execa from 'execa'

import { getPaths } from '@redwoodjs/internal'

export const command = 'storybook'
export const aliases = ['sb']
export const description =
  'Launch Storybook: An isolated component development environment'

export const builder = (yargs) => {
  yargs
    .option('open', {
      describe: 'Open storybooks in your browser on start',
      type: 'boolean',
      default: true,
    })
    .option('build', {
      describe: 'Build Storybook',
      type: 'boolean',
      default: false,
    })
    .option('port', {
      describe: 'Which port to run storybooks on',
      type: 'integer',
      default: 7910,
    })
    .option('build-directory', {
      describe: 'Directory in web/ to store static files',
      type: 'string',
      default: 'public/storybook',
    })
}

export const handler = ({ open, port, build, buildDirectory }) => {
  const cwd = getPaths().web.base

  const staticAssetsFolder = path.join(getPaths().web.base, 'public')
  // Create the `MockServiceWorker.js` file
  // https://mswjs.io/docs/cli/init
  execa(`yarn msw init "${staticAssetsFolder}" --no-save`, undefined, {
    stdio: 'inherit',
    shell: true,
    cwd,
  })

  const storybookConfig = path.dirname(
    require.resolve('@redwoodjs/testing/config/storybook/main.js')
  )

  execa(
    `yarn ${build ? 'build' : 'start'}-storybook`,
    [
      `--config-dir "${storybookConfig}"`,
      !build && `--port ${port}`,
      !build && '--no-version-updates',
      !build && `--static-dir "${staticAssetsFolder}"`,
      build &&
        `--output-dir "${path.join(getPaths().web.base, buildDirectory)}"`,
      !open && '--ci',
    ].filter(Boolean),
    {
      stdio: 'inherit',
      shell: true,
      cwd,
    }
  )
}
