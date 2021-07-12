#!/usr/bin/env node
/* eslint-disable no-undef */
/* eslint-env node, es6*/

const fs = require('fs')

const { Octokit } = require('octokit')
const yargs = require('yargs')

// ------------------------

const milestonesQuery = `
  query($title: String!) {
    repository(owner: "redwoodjs", name: "redwood") {
      milestones(query: $title, first: 10) {
        nodes {
          title
          id
        }
      }
    }
  }
`

const prsQuery = `
  query($id: ID!) {
    node(id: $id) {
      ... on Milestone {
        title
        pullRequests(first: 100) {
          nodes {
            number
            title
            author {
              login
            }
          }
          totalCount
          pageInfo {
            hasNextPage
          }
        }
      }
    }
  }
`

// a pr looks like...
//
// {
//   "number": 2613,
//   "title": "Scaffold Generator File Organization",
//   "author": {
//     "login": "cjreimer",
//   },
// }
const formatPR = (pr) => `- ${pr.title} #${pr.number} by @${pr.author.login}`

const getNoOfUniqueContributors = (prs) => {
  const logins = prs.map((pr) => pr.author.login)
  return new Set(logins).size
}

// ------------------------

const builder = (yargs) =>
  yargs.positional('milestone', {
    describe: 'the milestone to generate release notes for',
    type: 'string',
  })

const handler = async (argv) => {
  if (!process.env.GITHUB_TOKEN) {
    console.log()
    console.error(
      `  You have to provide a github token. Make sure there's a var named GITHUB_TOKEN in your env.`
    )
    console.error(
      `  You can provision an personal access token here: https://github.com/settings/tokens`
    )
    console.log()

    return
  }

  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN })

  // get the milestone's id
  // ------------------------

  const title = argv.milestone

  const {
    repository: { milestones },
  } = await octokit.graphql(milestonesQuery, { title })

  const milestone = milestones.nodes.find(
    (milestone) => milestone.title === title
  )

  id = milestone.id

  // get the PRs
  // ------------------------

  console.log()
  console.log(`Getting PRs for milestone "${title}"`)

  const {
    node: { pullRequests },
  } = await octokit.graphql(prsQuery, { id })

  // - count unique contributors
  // - format PRs
  // ------------------------

  const noOfUniqueContributors = getNoOfUniqueContributors(pullRequests.nodes)
  const formattedPRs = pullRequests.nodes.map(formatPR)

  // write
  // ------------------------

  const fileName = `${title}-release-notes.md`

  fs.writeFileSync(
    fileName,
    [
      `# ${title}`,
      '',
      `No. of unique contributors: ${noOfUniqueContributors}`,
      '',
      `No. of PRs: ${pullRequests.nodes.length}`,
      '',
      ...formattedPRs,
    ].join('\n')
  )

  console.log(`Written to "${fileName}"`)
  console.log('Done')
  console.log()
}

// eslint-disable-next-line no-unused-expressions
yargs
  .scriptName('build:release-notes')
  .usage(
    '$0 <milestone>',
    'build release notes for a milestone',
    builder,
    handler
  )
  .help()
  .strict().argv
