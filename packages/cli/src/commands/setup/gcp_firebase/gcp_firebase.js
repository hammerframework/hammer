import fs from 'fs'
import path from 'path'

import { template as lt } from 'lodash'
import Listr from 'listr'

import c from 'src/lib/colors'
import { getPaths, writeFile } from 'src/lib'

export const command = 'gcp_firebase'
export const description = 'Setup firebase hosting and GCP services'
export const builder = (yargs) => {
  yargs
    .option('force', {
      alias: 'f',
      default: false,
      description: 'Overwrite existing configuration',
      type: 'boolean',
    })
    .option('project', {
      description: 'GCP project name',
      demand: true,
      type: 'string',
    })
    .option('site', {
      description: 'Firebase hosting site to deploy to',
      demand: true,
      type: 'string',
    })
    .option('container-name', {
      description: 'Name of Cloud Run API container',
      default: 'redwood-api',
      type: 'string',
    })
    .option('db-name', {
      description: 'Name of Cloud SQL PostgreSQL database',
      demand: true,
      type: 'string',
    })
    .option('db-password', {
      description: 'Password to use in Cloud SQL connection string',
      demand: true,
      type: 'string',
    })
    .option('region', {
      description: 'Region Cloud Run container is running in',
      default: 'us-central1',
      type: 'string',
    })
    .option('api-routes', {
      description: 'Routes that should be API cloud run container',
      default: ['/graphql'],
    })
    .parserConfiguration({
      'greedy-arrays': false,
    })
}

export const handler = async ({
  force,
  apiRoutes,
  containerName,
  dbName,
  dbPassword,
  project,
  region,
  site,
}) => {
  const tasks = new Listr([
    {
      title: 'Configuring firebase project aliases...',
      task: () => {
        const template = lt(
          fs.readFileSync(
            path.resolve(__dirname, 'templates', 'firebaserc.template'),
            'utf8'
          )
        )
        return writeFile(
          path.join(getPaths().base, '.firebaserc'),
          template({ project, site }),
          { overwriteExisting: force }
        )
      },
    },
    {
      title: 'Configuring firebase project...',
      task: () => {
        const template = lt(
          fs.readFileSync(
            path.resolve(__dirname, 'templates', 'firebase.json.template'),
            'utf8'
          )
        )
        return writeFile(
          path.join(getPaths().base, 'firebase.json'),
          template({ apiRoutes, containerName, project, region, site }),
          { overwriteExisting: force }
        )
      },
    },
    {
      title: 'Generating cloudbuild.yaml for deployment',
      task: () => {
        const template = lt(
          fs.readFileSync(
            path.resolve(__dirname, 'templates', 'cloudbuild.yaml.template'),
            'utf8'
          )
        )
        return writeFile(
          path.join(getPaths().base, 'cloudbuild.yaml'),
          template({
            apiRoutes,
            containerName,
            databaseSubstitution: '${_DATABASE_URL}',
            dbName,
            project,
            region,
            site,
          }),
          { overwriteExisting: force }
        )
      },
    },
    {
      title: 'Generate .env file with DB connection string',
      task: () => {
        const template = lt(
          fs.readFileSync(
            path.resolve(__dirname, 'templates', 'env.template'),
            'utf8'
          )
        )
        return writeFile(
          path.join(getPaths().base, '.env'),
          template({
            apiRoutes,
            containerName,
            dbPassword,
            dbName,
            project,
            region,
            site,
          }),
          { overwriteExisting: force }
        )
      },
    },
    {
      title: 'Generate Dockerfile for building container...',
      task: () => {
        const template = lt(
          fs.readFileSync(
            path.resolve(__dirname, 'templates', 'Dockerfile.template'),
            'utf8'
          )
        )
        return writeFile(path.join(getPaths().base, 'Dockerfile'), template(), {
          overwriteExisting: force,
        })
      },
    },
  ])

  try {
    await tasks.run()
  } catch (e) {
    console.log(c.error(e.message))
  }
}
