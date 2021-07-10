export const preRequisites = [
  {
    title: 'Checking if gcloud is installed...',
    command: ['gcloud', ['--version']],
    errorMessage: [
      'Looks like the gcloud bin is not installed.',
      'Please follow the instructions at https://cloud.google.com/sdk/docs/install to install the Google Cloud SDK.',
    ],
  },
  {
    title: 'Checking if firebase is installed...',
    command: ['firebase', ['--version']],
    errorMessage: [
      'Looks like the firebase bin is not installed.',
      'Please follow the instructions at https://firebase.google.com/docs/cli to install.',
    ],
  },
]

export const buildCommands = [
  { title: 'Building API...', command: ['yarn', ['rw', 'build', 'api']] },
]

export const deployCommand = {
  title: 'Deploying...',
  command: [
    'gcloud',
    [
      'builds',
      'submit',
      `--project=${process.env.GOOGLE_CLOUD_PROJECT}`,
      `--substitutions=_DATABASE_URL=${process.env.DATABASE_URL}`,
    ],
  ],
}
