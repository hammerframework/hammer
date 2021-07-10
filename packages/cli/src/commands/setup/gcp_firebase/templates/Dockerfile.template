# Use the official lightweight Node.js 12 image.
# https://hub.docker.com/_/node
FROM node:14-alpine

# Copy local code to the container image:
COPY ./api ./api

# Generate the prisma database client:
RUN yarn add @prisma/cli
RUN yarn prisma generate --schema api/prisma/schema.prisma
RUN yarn remove @prisma/cli

# Install dependencies for running function:
RUN yarn add @redwoodjs/api
RUN yarn add @redwoodjs/api-server
# TODO: investigate why this dependency is required:
RUN yarn add @babel/runtime-corejs3

ENV NODE_ENV=production
CMD yarn run api-server -f ./api/dist/functions/ --port=$PORT

