import { memoize } from 'lodash'
import { parse } from 'graphql'

export const rootSchema_parsed = memoize(() => parse(rootSchema))

// this is manually copied from the api package
export const rootSchema = `
scalar Date
scalar Time
scalar DateTime
scalar JSON
scalar JSONObject

type Redwood {
  version: String
  currentUser: JSON
  prismaVersion: String
}

type Query {
  redwood: Redwood
}`
