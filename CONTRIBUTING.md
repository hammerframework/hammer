# Contributing to RedwoodJS
Love RedwoodJS and want to get involved? You’re in the right place and in good company! As of this writing, there are more than [170 contributors](#contributorsList) who have helped make RedwoodJS awesome by helping [triage issues](https://github.com/redwoodjs/redwood/issues), contributing [code](#contributing-code), and contributing [docs](#contributing-docs). This doesn't include all of those who participate in our vibrant, helpful, and encouraging [Forums](https://community.redwoodjs.com/) and [Discord](https://discord.gg/jjSYEQd) channel, which are both great places to get started if you have any questions. And if any RedwoodJS slang is unfamiliar, you can find a quick definition in the [glossary](#glossary).

> Before interacting with the RedwoodJS community, please read and understand our [Code of Conduct](https://github.com/redwoodjs/redwood/blob/main/CODE_OF_CONDUCT.md#contributor-covenant-code-of-conduct).

## Table of Contents
  - [Short Links to Important Resources](#short-links-to-important-resources)
    - [Community](#community)
    - [Documentation](#documentation)
    - [Bugs](#bugs)
    - [Security](#security)
  - [Getting Started](#getting-started)
    - [The Basics of RedwoodJS, GitHub, and Git](#the_basics_of_redwood_git_and_github)
    - [Setting Up a Local Framework Development Environment](#setting_up_a_local_framework_development_environment)
    - [Building](#building)
    - [Testing](#testing)
    - [Troubleshooting](#troubleshooting)
  - [Contributions](#contributions)
    - [How to Submit a Pull Request](#how-to-submit-a-pull-request)
    - [How to Open an Issue](#how-to-open-an-issue)
    - [Finding Issues to Work On](finding-issues-to-work-on)
    - [First Bugs for Contributors](#first-bugs-for-contributors)
    - [Join a Contributing Project](#join_a_contributing_project)
  - [Most Everything Else](#most-everything-else)
    - [How to Request a New Feature](#how-to-request-a-new-feature)
    - [Style Guide and Coding Conventions](#style-guide-and-coding-conventions)
    - [Code of Conduct](#code-of-conduct)
    - [TYIA! (thank you in advance)](#tyia!-\(thank-you-in-advance\))
    - [How to Ask for Help](#where-can-i-ask-for-help)
  - [See Who's Involved](#see-who-is-involved)



## Short Links to Important Resources

### 📢 Community
This is your next step! There’s a vibrant, helpful community standing by to guide you toward your next step, whatever it may be. We hope you'll stop by and introduce yourself - just say hi! Ask a question - how can people help you take the next step? If you’re interested in contributing, please let us know what you’d like to help with.

- [**RedwoodJS Forums**](https://community.redwoodjs.com)
- [**Discourse Chat Channel**](https://discord.gg/jjSYEQd)
- [**RedwoodJS on Twitter**](https://twitter.com/redwoodjs)

### 📝 Documentation
- The [**Framework Code Overview**](#framework-code-overview) gives you a quick rundown of the different packages used in the framework and how they fit together, as well as links to more detailed info
- [**RedwoodJS Docs**](https://redwoodjs.com/docs/introduction) for reference while you're coding RedwoodJS apps
- [**RedwoodJS Cookbooks**](https://redwoodjs.com/docs/cookbook) take you through the steps required to solve some example real-world problems
- [**RedwoodJS Tutorials**](https://learn.redwoodjs.com/docs/tutorial/welcome-to-redwood/) take you by the hand through a series of steps to complete a RedwoodJS app

### 🐛 Bugs
- [**How to Report Bugs**](#bug-reports)
- [**RedwoodJS's Issue Tracker**](https://github.com/redwoodjs/redwood/issues)

### 🛡️ Security
- [**RedwoodJS Security Policy**](#docs/security)
- [**Report a Security Vulnerability**](mailto:security@redwoodjs.com)



## Getting Started

As a RedwoodJS user, you're already familiar with the *Create Redwood App* (CRWA) codebase created when you run `yarn create <my-redwood-app-name>`. You'll see that codebase referred to as a **RedwoodJS app** in docs and discussions. As a contributor, you'll have to gain familiarity with another codebase: the **RedwoodJS framework**. The framework lives in the monorepo [`redwoodjs/redwood`](https://github.com/redwoodjs/redwood) and contains all the packages that make RedwoodJS apps work the way they do.

The heart of the framework is the [create-redwood-app](https://github.com/redwoodjs/redwood/tree/main/packages/create-redwood-app) package. Yarn (the package management tool used by RedwoodJS) has [special handling](https://classic.yarnpkg.com/en/docs/cli/create/) for starter kits that follow a `create-*` naming convention. You can find the templates that are used to generate new RedwoodJS apps in this package.

The other packages in the framework repo's `packages` directory are various libaries used by RedwoodJS apps, like the [cli](https://github.com/redwoodjs/redwood/tree/main/packages/cli) tool used for command line interaction with your RedwoodJS app or the [web](https://github.com/redwoodjs/redwood/tree/main/packages/web) library that provides hooks to use in your frontend React code.  These libraries are installed as part of the `yarn create <my-redwood-app-name>` workflow. In a typical RedwoodJS app, you can find the RedwoodJS framework library modules namespaced in the `./node_modules/@redwoodjs` directory.

### 🪢The Basics of RedwoodJS, GitHub, and Git

#### Learning RedwoodJS

To contribute to framework code, you should have some familiarity with how RedwoodJS apps work and how to create one. The [RedwoodJS Tutorial](https://redwoodjs.com/tutorial) is the best, and most fun, way to learn RedwoodJS and the underlying tools and technologies. The [RedwoodJS Docs](https://redwoodjs.com/docs/introduction) have in-depth explanations of how to use the various pieces of the RedwoodJS framework in your app, like setting up [routing](https://redwoodjs.com/docs/redwood-router) and handling [assets](https://redwoodjs.com/docs/assets-and-files).

These resources will help with understanding how the framework works from an end-user perspective. For a birds-eye overview of the framework code from a contributor PoV, we also have you covered with our [framework code overview](#framework-code-overview).

#### GitHub (and Git)

Understandably, diving into [Git](https://git-scm.com/) and the [GitHub](https://github.com/) workflow can feel intimidating if you haven’t experienced it before. There’s a lot of great material to help you learn. And, most of all, we're sure you’ll quickly get the hang of it and will be rockin’ commits and pushes with the best of ‘em.

- [Introduction to GitHub](https://lab.github.com/githubtraining/introduction-to-github) (overview of concepts and workflow)
- [First Day on GitHub](https://lab.github.com/githubtraining/first-day-on-github) (including Git)
- [First Week on GitHub](https://lab.github.com/githubtraining/first-week-on-github) (parts 3 and 4 might be helpful)

### 💻 Setting Up a Local Framework Development Environment

#### Local Docs Development

Helping to improve RedwoodJS's docs is easy, because your changes are made directly in the relevant repo (`redwood` for this document and package-specific docs, and `redwoodjs.com` for most everything else). Docs are kept in Markdown format. We have a [handy guide](#contributing-docs) with details of the Markdown syntax RedwoodJS uses and how the web and tutorial site static HTML generators are configured. There are also some [recommended tools](#recommended-tools) you might find helpful, like a Markdown WYSIWYG editor.

#### Local Framework Development

Some code changes in the Redwoodjs framework can be completed within a local copy of the [`redwoodjs/redwood`](https://github.com/redwoodjs/redwood) repo, without also needing a RedwoodJS app to test changes in. Examples include:

- Changes to the CI / CD workflow for the repo using GitHub [Actions](https://docs.github.com/en/actions) and configured in the [`workflows`](https://github.com/redwoodjs/redwood/tree/main/.github/workflows) repo directory
- Utility [scripts](https://github.com/redwoodjs/redwood/tree/main/tasks) for use with `yarn run` or `npx` (defined in a `package.json` file under the `scripts` key)

Usually though, you'll want to see the effects of changes that you make to framework package library code in the context of a RedwoodJS app project. We have you covered! There's a special CLI tool (`redwood-tools`, aliased to `rwt`) that handles linking your local framework repo to a local app repo. Changes you make in the local framework repo show up immediately in your local app - [no muss, no fuss](https://www.ldoceonline.com/dictionary/no-muss-no-fuss). There are differences in setup based on your workstation platform (Windows, Mac, or Linux) and whether you want to use a default test app or a custom app.

Next step? See our [detailed guide](#local-framework-development) to setting up a local framework development environment.

#### Local CLI Development

You can run a development version of the [CLI](https://github.com/redwoodjs/redwood/tree/main/packages/cli) tool directly from your local copy of the framework repo without syncing any files or node modules. This is useful if you're working on a framework package that uses the CLI as its point of entry, or working on the CLI itself. Check out our [notes](#local-cli-development) on local CLI development for more.

### 🚇 Building

Running the `web` and `api` local HTTP servers from a test app is definitely DX (a **d**elightful e**x**perience)  as you work on framework contributions.  When you're finished up and ready to share your work, you'll need to generate a production build of the framework packages and make sure it completes without error (the end-to-end tests mentioned below will also catch these kinds of build-time bugs).

Build the packages and set up a watcher to rebuild when files change:

```terminal
yarn build
```

There are also subcommands of `build` that you can run separately, for example to delete previous build artifacts. Check out the `scripts` key in the packages and root `package.json` file in your framework repo for options.

### ⚠️ Testing

You probably know that RedwoodJS has you "covered" when it comes to testing your apps. Our [testing](https://github.com/redwoodjs/redwood/tree/main/packages/testing) package uses [Jest](https://jestjs.io/) for test running, [RTL](https://testing-library.com/docs/react-testing-library/intro/) for testing React components, [Mock Service Worker](https://mswjs.io/) for API mocking, and [Storybook](https://storybook.js.org/) to build and test components and pages in isolation. We've collected helpful notes on testing RedwoodJS apps in our [Testing](https://redwoodjs.com/docs/testing) docs.

You can use the following tools and commands to check the syntax and formatting of your framework code:

```terminal
yarn lint
```

To fix linting errors or warnings:

```terminal
yarn lint:fix
```

The RedwoodJS framework also uses Jest to run unit tests. To run unit tests for each package:

```terminal
yarn test
```

There's more information on [testing framework code](#testing), including how to run the [Cypress](https://www.cypress.io/) end-to-end test suite.

### 📓 Troubleshooting

If you run into problems with framework code you're putting together, start troubleshooting with the basics:

- Check that your Node version and Yarn version match RedwoodJS's [prerequisites](https://learn-redwood.netlify.app/docs/tutorial/prerequisites/). Versions are checked when you install the framework repo, but system updates or [Node Version Manager](https://github.com/nvm-sh/nvm) might have changed the versions you're currently using.
- Make sure the framework builds by running `yarn build` in the root of the repo. It's possible your framework code runs when linked into an app but fails on a production build (and hopefully gives helpful output to identify the problem).
- Pull the latest commits from the RedwoodJS framework repo (discussed in [local framework development](#local-framework-development)). Especially if you're working on cutting edge features, changes and bug fixes can happen quickly. You can also check the [issue tracker](https://github.com/redwoodjs/redwood/issues) to see if anyone else is experiencing similar problems, or reach out on our community [Forums](https://community.redwoodjs.com) and [Discord Chat](https://discord.gg/jjSYEQd).
- Use the debugging tools in your code editor to zoom in on the problem. VS Code makes it really easy to set [breakpoints](https://code.visualstudio.com/docs/nodejs/nodejs-debugging) in your code and get a complete view of the environment at that point in your code, like the value of variables.

Our community [Forums](https://community.redwoodjs.com) and [Discord Chat](https://discord.gg/jjSYEQd) are great places to reach out for help with troubleshooting.



## Contributions

Contributing to open source is a great way to learn, teach, and  build experience in a rainbow of skills. More than just committing code or docs and honing your technical skills, contributors become become part of a community where they can practice soft skills like  communication, giving and receiving feedback, and enhancing emotional intelligence. RedwoodJS is intentional about this process. We have a specific vision for the effect this project and community will have on you — it should give you superpowers to build and create,  build skillsets, and help advance your career. Our community mantra highlights these goals:

> ***“By helping each other be successful with Redwood, we make the RedwoodJS project successful”***

We think successful contributors - more than any particular technical skill - will be people who value empathy, gratitude, and generosity. All of these are applicable in relation to both others *and* yourself. The goal of putting them into practice is to create *trust* that will be a catalyst for *risk-taking* (another word to describe this process is “learning”!). These are the ingredients necessary for productive and positive collaboration.

And you thought all this was just about opening a PR! Yes, it’s a super rewarding experience. But that’s just the beginning!

### 🖋 How to Submit a Pull Request
Some projects are really strict about their process for submitting PRs and issues. That's great in mature software domains, where governance, process management, and reporting are important for keeping the machine running without hiccups. We think of this approach as like planting a forest with future timber harvesting in mind. It's *efficient*, though maybe not *natural*.

RedwoodJS lives on ground (roughly called "[Jamstack](https://jamstack.org/)") that is still growing into its ecological niche. There's a huge diversity of approaches sprouting all over this landscape, and enormous potential. We don't want to place unnatural barriers between our contributors and good ideas finding root in RedwoodJS. In general, we don’t have a formal structure for PRs. Our goal is to make it as efficient as possible for anyone to open a PR. But there are some good practices, which are definitely flexible. We've put together some tips and examples on writing good PRs, along with details on the mechanics of submitting PRs: check out our [pull request tips](#pull-requests) for more.

A common mistake new contributors make is waiting until their code is “perfect” before opening a PR. Assuming your PR has *some* code changes, it’s great practice to open a [draft](https://github.blog/2019-02-14-introducing-draft-pull-requests/) PR to start discussion and ask questions.

### 🔥 How to Open an Issue

Anyone can create a new Issue on the [tracker](https://github.com/redwoodjs/redwood/issues). If you’re not sure that your idea or feature is useful to work on, start the discussion with an Issue. Describe the problem or idea and proposed solution as clearly as possible, including examples or pseudo code if possible. It’s also very helpful to `@` mention a maintainer or Core Team member who share the same area of interest in your issue.

Just know that there’s a *lot* of Issues that are opened every day. If no one replies, it’s only because people are busy. Reach out in the  [Forums](https://community.redwoodjs.com), [Discord Chat](https://discord.gg/jjSYEQd), or comment in the Issue. We intend to reply to every issue that’s opened. If yours doesn’t have a reply, then give us a nudge!

Lastly, it can often be helpful to start with brief discussion in the community Discord Chat or Forums. Sometimes that’s the quickest way to get feedback and a sense of priority before opening an Issue.

### 🔍 Finding Issues to Work On
> **Over the next few months, our focus is to achieve a v1.0.0 release of RedwoodJS. You can follow the status on our [Roadmap](https://redwoodjs.com/roadmap), which links to GitHub Project boards with associated tasks.**

Even if you know the mechanics, it’s hard to get started without a *place* to start. Our advice is to dive into the RedwoodJS Tutorial, read the docs, and build your own experiment with RedwoodJS. Along the way, you’ll find typos, out-of-date (or missing) documentation, code that could work better, or even opportunities for improving and adding features. You’ll be engaging in the Forums and Discord Chat and developing a feel for priorities and needs. This way, you’ll naturally follow your own interests. Sooner rather than later you'll find the intersection of “*things you’re interested in*” and “*ways to help improve RedwoodJS*”.

Eventually, you'll end up on Redwood’s GitHub [Issues page](https://github.com/redwoodjs/redwood/issues). Here you’ll find open items that need help and that are organized by labels. Some labels that are great to focus on include:

1. [Help Wanted](https://github.com/redwoodjs/redwood/issues?q=is%3Aissue+is%3Aopen+label%3A"help+wanted"): these items especially need contribution help from the community.
2. [v1 Priority](https://github.com/redwoodjs/redwood/issues?q=is%3Aissue+is%3Aopen+label%3Av1-priority): to reach RedwoodJS v1.0.0, we need to close *all* Issues with this label.

The sweet spot is a [v1 Priority](https://github.com/redwoodjs/redwood/labels/v1%2Fpriority) Issue that’s either a [Good First Issue](https://github.com/redwoodjs/redwood/issues?q=is%3Aopen+label%3A%22good+first+issue%22+label%3Av1%2Fpriority) or [Help Wanted](https://github.com/redwoodjs/redwood/issues?q=is%3Aopen+label%3A%22help+wanted%22+label%3Av1%2Fpriority). Yes, *please!*

### ✅ First Bugs for Contributors
A great way to get started with contributing to RedwoodJS is to find good first bugs. These are issues that can be solved with little experience. First bugs are also a great way for experienced contributors to learn a new domain or set of tools. They're not necessarily "easy," though some are. These bugs are meant to be well-contained and more likely to be an accessible entry point to the Framework. It’s less about skill level and more about focused scope.

First bugs are labeled [Good First Issue](https://github.com/redwoodjs/redwood/issues?q=is%3Aissue+is%3Aopen+label%3A"good+first+issue"). The person who marked the ticket as a *Good First Issue* - as well as  other members of the community - will help you through this ticket by  providing feedback along the way. Start by making sure you understand the  problem and verifying that you can reproduce it. Next, draw up or mentally map a plan of  attack, create a patch, and submit a pull request. *Win, win!*

### 🔌 Join a Contributing Project
There are several self-contained contributing projects in the RedwoodJS ecosystem. Discussion on them is mostly taking place in the [Forums](https://community.redwoodjs.com)). These are high-priority needs that already have a defined scope and (mostly) don’t require working on the Framework codebase directly. Current contributing projects include:

- [Redesign RedwoodJS’s 404 Not Found page](https://community.redwoodjs.com/t/find-time-to-redesign-redwoodjss-404-not-found-page/2052/4)
- [RedwoodJS Splash Page](https://community.redwoodjs.com/t/give-the-redwoodjs-splashpage-more-splash/2051/2)
- [Redesign Redwood’s Error Page](https://community.redwoodjs.com/t/hey-wha-happened-lets-redesign-redwoods-error-page/2053/7)

If you'd like to get involved with a contributing project, stop in the discussion in the respective Forum thread and say hi!



## Most Everything Else

### 💬 How to Request a New Feature
Don’t see a feature that you’d like to use to achieve your website-building goals? First stop is to check the [Roadmap](https://redwoodjs.com/roadmap) and see if it's already on the drawing board for a future release. If not, consider opening an issue to make your request known and to start a discussion about it. Keep in mind that a common problem with feature requests is that they are often very specific to the user who has requested it. Good feature requests benefit the majority of users and RedwoodJS as a whole.

To help others find your request, you can tag your issue with [`kind/discussion`](https://github.com/redwoodjs/redwood/labels/kind%2Fdiscussion) and an appropriate [`topic`](https://github.com/redwoodjs/redwood/labels/kind%2Fdiscussion) tag.

### 👀 Style Guide and Coding Conventions
RedwoodJS uses ESLint, Prettier, and the TypeScript compiler to help make sure the framework code can be easily understood and that consistency is maintained. The framework [`eslint-config`](https://github.com/redwoodjs/redwood/tree/main/packages/eslint-config) package is used both for framework configuration and RedwoodJS app (created with the [CRWA](https://github.com/redwoodjs/redwood/tree/main/packages/create-redwood-app) package) configuration.

Our configuration uses recommended rule presets, including those from [ESLint](https://eslint.org/docs/rules/), [React](https://www.npmjs.com/package/eslint-plugin-react#list-of-supported-rules), the [Rules of Hooks](https://reactjs.org/docs/hooks-rules.html), and [Jest](https://github.com/testing-library/eslint-plugin-jest-dom#supported-rules). We also override the presets with some stylistic preferences. Some of them are:

- [No semicolons](https://eslint.org/docs/rules/semi) at the end of statements
- [Trailing commas](https://eslint.org/docs/rules/comma-dangle) in object and array literals
- [Use single quotes](https://eslint.org/docs/rules/quotes) on strings wherever possible
- [Use parentheses](https://eslint.org/docs/rules/arrow-parens)  around arrow function parameters
- [Sort import declarations](https://eslint.org/docs/rules/sort-imports) by name
- [Wrap block statements](https://eslint.org/docs/rules/curly) in curly braces

For a full list of preset overrides, check out our [coding style](#coding-style) doc.

### 🧑‍🏫 Code of Conduct
This project and everyone participating in it is governed by the Contributor Covenant [Code of Conduct](https://github.com/redwoodjs/redwood/blob/main/CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Instances of abusive, harassing, or otherwise unacceptable behavior may be reported using the [procedure](https://github.com/redwoodjs/redwood/blob/main/CODE_OF_CONDUCT.md#enforcement-guidelines) detailed in the Code of Conduct. Please know that all community leaders are obligated to respect the privacy and security of the reporter of any incident.

### 💖 TYIA! (thank you in advance)
If you've read the contributing docs to this point, we want to give you a full-hearted thank you! RedwoodJS isn't a private club. We're a community of people that are just like you. And we know that projects that you actively contribute to are also the projects you'll likely find yourself coming back to. We really believe in the RedwoodJS approach to app development, and hope you find it a great fit for your own work.

### ❓ Where Can I Ask For Help?
If you hit any roadblocks or need help with your contributions to RedwoodJS, we'd love to help! Everybody is new to RedwoodJS at some point, and even experienced contributors need to learn the ropes when they work in unfamiliar areas of the code base. By the same token, even longtime maintainers aren'tt always familiar with every aspect of the framework.

Great places to ask for help are the RedwoodJS [Forums](https://community.redwoodjs.com/) and [Discord Chat](https://discord.gg/jjSYEQd) channel. Stop by and say hi!

## See Who is Involved✨
A gigantic "Thank YOU!" to everyone below who has contributed to one or more RedwoodJS projects:

* [Framework](https://github.com/redwoodjs/redwood)
* [Website](https://github.com/redwoodjs/redwoodjs.com)
* [Create-RedwoodJS Template](https://github.com/redwoodjs/create-redwood-app)

RedwoodJS projects (mostly) follow the [all-contributions](https://allcontributors.org/) specification using the `all-contributors` CLI tool. This lets us track the [Framework](https://github.com/redwoodjs/redwood), [create-redwood-app](https://github.com/redwoodjs/create-redwood-app), and [Website](https://github.com/redwoodjs/redwoodjs.com) project contributors and display them in a nice grid with profile information. For more information and related code, see [`tasks/all-contributors/README.md`](#).
