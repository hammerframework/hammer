# API

<!-- toc -->
  - [Purpose and Vision](#purpose-and-vision)
  - [Package Lead](#package-lead)
  - [Roadmap](#roadmap)
    - [GraphQL serverless Function](#graphql-serverless-function)
    - [Services layer](#services-layer)
    - [Schema definitions](#schema-definitions)
    - [Authentication](#authentication)
    - [Logging](#logging)
  - [Contributing](#contributing)
    - [Overview](#overview)
    - [`schemas` and `services` imports](#schemas-and-services-imports)
    - [`makeServices`](#makeservices)
    - [`makeMergedSchema`](#makemergedschema)
    - [`createGraphQLHandler`](#creategraphqlhandler)
  - [FAQ](#faq)
    - [How do I schema merge/stitch?](#how-do-i-schema-mergestitch)
    - [What databases does Redwood support?](#what-databases-does-redwood-support)
    - [Does Redwood Support SSR?](#does-redwood-support-ssr)
    - [Can I use Redwood without an API/database?](#can-i-use-redwood-without-an-apidatabase)

## Purpose and Vision

Redwood believes the future is serverless and multi-client. And `@redwoodjs/api` makes Redwood serverless and multi-client ready. By exposing a single GraphQL endpoint, Redwood has one API to rule them all. Your API is abstracted away from any one side of your application, so you can have as many sides as you need, and when you need them.

Right now, the `@redwoodjs/api` package exposes functions that 1) build a Redwood App’s serverless GraphQL API and 2) provide context to your services. The GraphQL API includes Date, Datetime and JSON scalar types, the ability to merge schemas, a place to store resolvers in services, and authentication.

Our vision is to provide frictionless and understandable integrations between the boundaries of Functions (capital F for serverless functions), GraphQL's schema and resolvers, Services (a Redwood concept), databases, and authentication.
We also plan to make Functions platform-agnostic. At the moment, we're targeting AWS Lambda, but we aim to provide a single interface for other providers and build-time support when you've targeted them.

## Package Lead

- [@peterp](https://github.com/peterp/)

## Roadmap

### GraphQL serverless Function

- Connect to a "Redwood universal logging service" for exceptions and info.

### Services layer

- What does Middleware for services look like?
- Can we improve the Authentication experience?

### Schema definitions

- The ability to export TypeScript definitions that are usable on the web side.

### Authentication

- What does RBAC look like?

### Logging

RedwoodJS provides an opinionated logger with sensible, practical defaults that grants you visibility into the JAMStack applications you're developing and have deployed  -- with ease.

Logging in the serverless ecosystem is not trivial and neither is its configuration.

When choosing a Node.js logger to add to the framework, RedwoodJS required that it:

* Have a low-overhead, and be fast
* Output helpful, readable information in development
* Be highly configurable to set log levels, time formatting, and more
* Support key redaction to prevent passwords or tokens from leaking out
* Save to a file in local (or other) environments that can write to the file system
* Stream to third-party log and application monitoring services vital to production logging in serverless environments like [logFlare](https://logflare.app/) and [Datadog](https://www.datadoghq.com/)
* Hook into [Prisma logging](https://www.prisma.io/docs/concepts/components/prisma-client/working-with-prismaclient/logging) to give visibility into connection issues, slow queries, and any unexpected errors
* Have a solid Developer experience (DX) to get logging out-of-the-gate quickly
* Use a compact configuration to set how to log (its `options`) and where to log -- file, stdout, or remote transport stream -- (its `destination`)

With those criteria in mind, Redwood includes [pino](https://github.com/pinojs/pino) with its rich [features](https://github.com/pinojs/pino/blob/master/docs/api.md), [ecosystem](https://github.com/pinojs/pino/blob/master/docs/ecosystem.md) and [community](https://github.com/pinojs/pino/blob/master/docs/ecosystem.md#community).

Plus ... pino means 🌲 pine tree! How perfect is that for RedwoodJS?

Note: RedwoodJS logging is setup for its api side only. For browser and web side error reporting or exception handling, these features will be addressed in a future release.

For detailed logger configuration, see the RedwoodJS logger package [README](./src/logger/README.md).

## Contributing

`@redwoodjs/api` uses a few things you should be familiar with:

- [Apollo Server](https://www.apollographql.com/docs/apollo-server/) (Lambda)
- [GraphQL](https://graphql.org/learn/)

Although this package depends, in the code-dependency sense, only on `@redwoodjs/internals`, it still hangs together with the others&mdash;notably, `@redwoodjs/web` and `@redwoodjs/api-server`. So if you’re asking yourself “but when does my server run?” head over to `@redwoodjs/api-server`.

### Overview

To give the `@redwoodjs/api` context, we'll be referring to the Redwood-App file [graphql.js](https://github.com/redwoodjs/create-redwood-app/blob/master/api/src/functions/graphql.js), where functions from `@redwoodjs/api` are imported and invoked.
Remember, files in this directory (`api/src/functions`) are serverless functions. This one in particular is a GraphQL API, and right now it’s what most of `@redwoodjs/api` is for&mdash;setting up the GraphQL API Redwood Apps come with by default. It all happens in essentially four steps:

1. Everything (i.e. sdl and services) is imported
2. The services are wrapped into resolvers
3. The sdl and resolvers are merged/stitched into a schema
4. The ApolloServer is instantiated with said merged/stitched schema and context

These four steps map quite nicely to these four "code" steps, some of which are doing a little more under-the-hood than others:

1. `schema` and `services` imports
1. `makeServices`
2. `makeMergedSchema`
3. `createGraphQLHandler`

### `schemas` and `services` imports

In Redwood Apps, the resolvers are mapped automatically. The schemas are in the `./api/src/graphql` directory and the resolvers are in the `./api/src/services` directory, and as long as you export the right things with the right names from the right files, they get merged together.

All of that magic actually happens in your Redwood App, in `./api/src/functions/graphql.js`. And since everything’s separated, the first thing Redwood does is import it all.

Using a babel plugin ([redwood-import-dir](https://github.com/redwoodjs/redwood/blob/687abc207a83bf078df3944cdff00697efa3bf17/packages/core/src/babel-plugin-redwood-import-dir.ts)), we can use regular-looking import statements to import all the schemas and services:

```javascript
import schemas from 'src/graphql/**/*.{js,ts}'
import services from 'src/services/**/*.{js,ts}'
```

Using `services` as an example, `services` will be an object that contains all the imports of all the matched files in the specified directory (here, services). It's the equivalent of running:

```javascript
let services = {}
import * as services_a from '../__fixtures__/a'
services.a = services_a
import * as services_b from '../__fixtures__/b'
services.b = services_b
import * as services_c_sdl from '../__fixtures__/c.sdl'
services.c_sdl = services_c_sdl
import * as services_nested_d from '../__fixtures__/nested/d'
services.nested_d = services_nested_d
```

### `makeServices`

`makeServices` actually doesn’t do anything yet. It’s just a stub for when we fully introduce the concept of Services.

Our vision for Services is to provide a run-time middleware layer that can run before or after a service is executed. For example:

```javascript
import { debugToConsole, printExecutionTimeInMs } from '@redwoodjs/services-middleware-debug'
import { verifyUserRole } from '@redwoodjs/services-auth-middleware'

// services/todos.js

export const before = {
   deleteTodo: verifyUserRole('admin'),
}

export const after = {
    'all': [debugToConsole, printExecutionTimeInMs]
}

export const deleteTodo = ({ id } ) => {
   // delete from prisma
}
```

Note that this is very much just an example.

### `makeMergedSchema`

Everything's imported, but the services are still services. They need to be wrapped into resolvers.

The babel-plugin imports don't try to figure out which of your services are supposed to be resolvers. Instead, they import everything and let `mergeResolversWithServices` figure it out.

> Ever noticed that in GraphiQL you can query "redwood"? This’s defined in the root schema.

### `createGraphQLHandler`

As far as the schema goes, at this point, the hard part’s done. All that’s left to do is pass it to Apollo Server. So the hard part here’s what’s happening with context. But what exactly is context?

Context is a function called with the current request to create the context shared across all resolvers. [Via the GraphQL docs](https://graphql.org/learn/execution/#root-fields-resolvers):

> Context [is] a value which is provided to every resolver and holds important contextual information like the currently logged in user, or access to a database.

We’re running on AWS Lambda, so context has to accept an object that looks like this:

```
{
  event: APIGatewayProxyEvent,
  context: LambdaContext
}
```

(Links to [APIGatewayProxyEvent](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/50adc95acf873e714256074311353232fcc1b5ed/types/aws-lambda/index.d.ts#L78-L92) and [LambdaContext](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/50adc95acf873e714256074311353232fcc1b5ed/types/aws-lambda/index.d.ts#L510-L534).)

And that’s what `handleContext` returns. But why are we passing `options` to `handleContext`? Didn’t we just use `options` to configure the schema? We did, and since we did so by destructuring `options`, we’re actually giving you the chance to do a lot more than just configure the schema—you can [configure Apollo Server](https://www.apollographql.com/docs/apollo-server/api/apollo-server/) however you want.

And by passing `options` to `handleContext` we’re giving you another layer of configuration—the chance to create your own custom context object or function when you initialize the handler in `graphql.js`.

While we just told you context’s for resolvers, Redwood actually goes the extra mile and exports context so any of your services can use it:

```
import { context } from '@redwoodjs/api'
```

<!-- Normally you’d be running the server now, `server.listen().then...` But Redwood does things a little differently. As you might’ve guessed from the name, createGraphQLHandler returns a handler. In Redwood, serverless functions have to return a handler. -->

> **Read the Docs:** Now’s a good time to head over to [@redwoodjs/dev-server](https://github.com/redwoodjs/redwood/blob/bdb112f5d10f41697b9068bdeee93631811109bf/packages/dev-server/README.md).

## FAQ

### How do I schema merge/stitch?

Provided you have all the right files in all the right places, Redwood does all the merging/stitching for you. For an example of including a third party API, see [Using a Third Party API](https://redwoodjs.com/cookbook/using-a-third-party-api).

### What databases does Redwood support?

Redwood uses Prisma, which currently supports the following databases: https://www.prisma.io/docs/more/supported-databases.

### Does Redwood Support SSR?

We get this question a lot. And our answer is [we hope we don’t have to](https://community.redwoodjs.com/t/ssr-on-the-roadmap/251/2). We think our approach will be “prerender” vs. “server-side render”.

### Can I use Redwood without an API/database?

Yes, see [Disable API/Database](https://redwoodjs.com/cookbook/disable-api-database).
