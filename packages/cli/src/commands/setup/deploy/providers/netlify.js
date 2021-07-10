import path from 'path'

import { getPaths, getConfig } from 'src/lib'

const config = getConfig()

const NETLIFY_TOML = `[build]
command = "yarn rw deploy netlify"
publish = "web/dist"
functions = "api/dist/functions"

[dev]
  # To use [Netlify Dev](https://www.netlify.com/products/dev/),
  # install netlify-cli from https://docs.netlify.com/cli/get-started/#installation
  # and then use netlify link https://docs.netlify.com/cli/get-started/#link-and-unlink-sites
  # to connect your local project to a site already on Netlify
  # then run netlify dev and our app will be accessible on the port specified below
  framework = "redwoodjs"
  # Set targetPort to the [web] side port as defined in redwood.toml
  targetPort = ${config.web.port}
  # Point your browser to this port to access your RedwoodJS app
  port = 8888

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
`

// any files to create
export const files = [
  { path: path.join(getPaths().base, 'netlify.toml'), content: NETLIFY_TOML },
]

export const apiURL = '/.netlify/functions'

// any notes to print out when the job is done
export const notes = [
  'You are ready to deploy to Netlify!',
  'See: https://redwoodjs.com/docs/deploy#netlify-deploy',
]
