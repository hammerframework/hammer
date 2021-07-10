// The `process.env.*` values are replaced by webpack at build time.
global.REDWOOD_API_URL = process.env.REDWOOD_API_URL as string
global.REDWOOD_API_GRAPHQL_SERVER_PATH = process.env
  .REDWOOD_API_GRAPHQL_SERVER_PATH as string
