# Contributing

Love Redwood and want to get involved? You’re in the right place!

Before interacting with the Redwood community, please read and understand our [Code of Conduct](https://github.com/redwoodjs/redwood/blob/main/CODE_OF_CONDUCT.md).

**Table of Contents**

- [Contributing](#contributing)
  - [Local Development](#local-development)
    - [Code Organization](#code-organization)
    - [Local Setup](#local-setup)
      - [Redwood Framework](#redwood-framework)
      - [Redwood App: Create a Functional Test Project](#redwood-app-create-a-functional-test-project)
        - [Running the Test Project Script](#running-the-test-project-script)
    - [Testing Framework code in your App](#testing-framework-code-in-your-app)
      - [Option 1: Linking](#option-1-linking)
      - [Option 2: Copy and Watch](#option-2-copy-and-watch)
      - [Option 3: Copy (for Windows)](#option-3-copy-for-windows)
      - [Option 4: Testing the CLI](#option-4-testing-the-cli)
      - [Specifying a RW_PATH](#specifying-a-rw_path)
        - [On **Linux**](#on-linux)
        - [On **MacOS**](#on-macos)
        - [On **Windows**](#on-windows)
    - [Local Package Registry Emulation](#local-package-registry-emulation)
      - [Running a Local NPM Registry](#running-a-local-npm-registry)
      - [Publishing a Package](#publishing-a-package)
      - [Installing Published Packages in Your Redwood App](#installing-published-packages-in-your-redwood-app)
  - [Running Your Redwood App's Local Server(s)](#running-your-redwood-apps-local-servers)
  - [Integration tests](#integration-tests)
  - [Releases](#releases)
    - [Troubleshooting](#troubleshooting)
  - [CLI Reference: `redwood-tools`](#cli-reference-redwood-tools)
    - [redwood-tools (rwt)](#redwood-tools-rwt)
    - [copy (cp)](#copy-cp)
    - [copy:watch (cpw)](#copywatch-cpw)
    - [fix-bins (fix)](#fix-bins-fix)
    - [install (i)](#install-i)
    - [link](#link)

## Local Development

### Code Organization

As a Redwood user, you're already familiar with the codebase created by `yarn create redwood-app`. In this document, we'll refer to that codebase as a 'Redwood App'. As a contributor, you'll have to gain familiarity with another codebase: the Redwood Framework.

The Redwood Framework lives in the monorepo `redwoodjs/redwood` (which is where you're probably reading this). It contains all the packages that make Redwood Apps work the way they do. In a typical Redwood App, you can find the Redwood Framework in `./node_modules/@redwoodjs`.

Throughout this document, we'll assume your local copy of the Redwood Framework is in a directory called `redwood` and your Redwood App is in a directory called `redwood-app`.

### Local Setup

#### Redwood Framework

Use `git clone` to make a local copy of the Redwood Framework. As mentioned above, we'll assume your local copy is in a directory called `redwood`. This is where you'll be making most of your changes.

If you already have a local copy, make sure you've got the `main` branch's latest changes with `git pull`.

Then run `yarn install` in the root directory to install all the dependencies:

```terminal
cd redwood
yarn install
```

#### Redwood App: Create a Functional Test Project

Most often, you'll need to test the functionality of your code in a local Redwood App. We'll assume your Redwood App is going to be a directory called `redwood-app`.

There are several options:
- run `yarn create redwood-app ./redwood-app` to install a fresh codebase (with no functionality)
- `git clone` the [RedwoodJS Tutorial Blog](https://github.com/redwoodjs/redwood-tutorial)
- use an App you already created
- Or run `yarn run build:test-project` to create a functional test project 👀

**Using the functional test project might be the easiest and fastest way to test your changes in Redwood.** You can create a Redwood project that contains a big range of functionality in a few minutes:
1. it installs using the App template codebase in the current branch of your Framework
2. with the current `canary` version of Redwood Packages (with the option to use the `latest` stable version)
3. with a JavaScript language target (with the option for TypeScript)
4. then applies code mods from the [Redwood tutorial](https://learn.redwoodjs.com/docs/tutorial/welcome-to-redwood/) to add functionality and styling
5. and initializes a Prisma DB migration for SQLite

At the end, you will have a fully working Redwood blog.

##### Running the Test Project Script
Run the following in the `redwood` folder root (_note: the script will automatically install dependencies_):

```terminal
yarn run build:test-project <path/to/redwood-app>
```

| Arguments & Options  | Description                                                          |
|----------------------|----------------------------------------------------------------------|
| `<project directory>` | Directory to build test project [default: "./blog-test-project"]    |
| `--typescript, --ts` | Generate a TypeScript project [default: JavaScript]                  |
| `--canary`           | Upgrade project to latest canary version [default: true]             |
| `--help `            | Show help                                                            |

**Example Use:**
```terminal
cd redwood/
yarn run build:test-project ~/my-repos/redwood-app --typescript --canary
```
### Testing Framework code in your App

As you make changes to your local copy of the Redwood Framework, you'll want to see the effects "live" in your Redwood App.

Since we're always looking for ways to make contributing to Redwood easier, there are a few workflows we've come up with, but the one you'll want to use is `yarn rwt link`. You can fall back on any of the others if that one doesn't work, but once you've tried `yarn rwt link`, you won't want to.

> **I've used `yarn rw` before, but what's `yarn rwt`?**
>
> All workflows use `redwood-tools` (`rwt`), Redwood's companion CLI development tool.

#### Option 1: Linking

Now that everything's [up-to-date and installed](#local-setup), go to your `redwood-app` and run `yarn rwt link`:

```bash
cd redwood-app
yarn rwt link ../path/to/redwood
```

> You can avoid having to provide the path to `redwood` by defining an `RW_PATH` environment variable on your system. See [Specifying a `RW_PATH`](#specifying-a-rw_path).

`rwt link` will first add the redwood workspace to your Redwood App. Then you'll see a ton of output &mdash; `rwt link` is building the Redwood Framework, watching it for changes, and copying all that over into the new redwood workspace in your Redwood App.

Your Redwood App isn't using the packages in `node_modules/@redwoodjs` anymore. It's now using the packages in the new workspace with your local changes. You can even install packages or upgrade dependencies &mdash; it's really that simple.

`rwt link` won't return you to the command line. Once it sets everything up you should see:
```terminal
   ┌─────────────────────────────────────────────────────────────┐
   │                                                             │
   │   🚀 Go Forth and Contribute!                               │
   │                                                             │
   │   🔗  Your project is linked!                               │
   │                                                             │
   │   Contributing doc: https://redwoodjs.com/docs/contributing │
   │                                                             │
   └─────────────────────────────────────────────────────────────┘
```

you can open a new tab in your terminal, cd to `redwood-app` and launch your Redwood App from there. As you make changes in `redwood`, you will see those changes immediately in the behavior of your Redwood App.

When you're done, go back to your `rwt link` tab and ctrl-c to quit. `rwt link` will ask you to run the `yarn rwt unlink` command. This will restore your Redwood App to its original state, reverting it to the version of Redwood that it originally had installed.

Next time you want to contribute, just run `yarn rwt link` again!


*Flags for rwt link command:*
| Flag | Description                              |
| :------------------ | :--------------------------------------- |
| `RW_PATH`              | Path to the framework repo. Required if RW_PATH environment var not set                         |
| `--clean, -c`       | Clean the framework repo before linking? Set this to false to speed things up if you're sure your build folders are clean [default: true]                 |
| `--watch, -w`           | Set this to false if you just want to link once and not watch for file changes [default: true]      |
<br>


> Having trouble with `rwt link`? Check the [rwt link FAQ](https://github.com/redwoodjs/redwood/issues/2215). If that doesn't help, please try one of the legacy contributing flows below.

#### Option 2: Copy and Watch

`yarn rwt link` not working for you? That's ok &mdash; we have a few legacy contributing workflows that you can fall back on.

After you've gotten everything [up-to-date and installed](#local-setup), make sure your Redwood App is on the latest canary release:

```terminal
cd redwood-app
yarn rw upgrade -t canary
yarn install
```

Now you'll want to build-and-watch the files in the Redwood Framework for changes:

```terminal
cd redwood
yarn build:watch
```

this will echo:

```terminal
@redwoodjs/api: $ nodemon --watch src -e ts,js --ignore dist --exec 'yarn build'
@redwoodjs/core: $ nodemon --ignore dist --exec 'yarn build'
create-redwood-app: $ nodemon --ignore dist --exec 'yarn build'
```

`build:watch` won't return you to the command line. Once it stops outputting to the terminal, you can open a new tab in your terminal, cd to `redwood-app` and run `rwt copy:watch` to get the changes in your local copy of the Redwood Framework:

```terminal
cd redwood-app
yarn rwt copy:watch ../path/to/redwood
```

You can also use the alias `cpw`:

```terminal
cd redwood-app
yarn rwt cpw ../path/to/redwood
```

> You can avoid having to provide the path to `redwood` by defining an `RW_PATH` environment variable on your system. See [Specifying a `RW_PATH`](#specifying-a-rw_path).

this will echo:

```terminal
Redwood Framework Path:  /something/something/redwoodjs/redwood
Trigger event:  add
building file list ... done
```

`rwt copy:watch` won't return you to the command line. Once it stops outputting to the terminal, you can open a new tab in your terminal, cd to `redwood-app` and launch your Redwood App. As you make changes in `redwood`, you will see those changes immediately in the behavior of your Redwood App.

Now any changes made in the framework will be copied into your app!

When you're done, go back to your `build:watch` and `rwt copy:watch` tabs and ctrl-c to quit.

Then, you can restore your Redwood App to its original state by deleting `./node_modules`, `web/node_modules`, and `api/node_modules`, then running `yarn install`.

#### Option 3: Copy (for Windows)

If you are on Windows and not using WSL, you will have to use `rwt cp` (this is tracked in [issue #701](https://github.com/redwoodjs/redwood/issues/701)). This method, unfortunately, will not let you see your changes live.

Also, you most likely first have to [install `rsync`](https://tlundberg.com/blog/2020-06-15/installing-rsync-on-windows/).

Finally, ensure that appropriate Windows permissions are available to create symbolic links. This can be accomplished via turning on Windows Developer Mode on Windows 10. Go to Settings and find the `For developers` page. Turn on the `Developer Mode` toggle. Alternately, running your shell or VSCode as an Administrator will also work, but is the less preferred option.

Each time you make a change to your local Redwood Framework, you'll have to build it:

```terminal
cd redwood
yarn build
```

Then, you'll go to your Redwood App and copy the changes:

```terminal
cd redwood-app
yarn rwt cp ../path/to/redwood
```

Then you can test the effects of your changes. Unfortunately, each time you make a change to your local Redwood Framework, you'll have to manually run `build` and `rwt cp` again.

When you're done, you can restore your Redwood App to its original state by deleting `./node_modules`, `web/node_modules`, and `api/node_modules`, then running `yarn install`.

#### Option 4: Testing the CLI

If you've made build or design time changes to RedwoodJS, that is if you have modified one of the following packages:

```terminal
./packages/
├ api-server
├ cli
├ core
├ dev-server
├ eslint-config
├ internal
├ prerender
├ structure
├ testing
```


You can run a development version of the CLI directly from the framework's repo where you don't have to sync any files or node modules.

(For all of the packages above the entry point is the CLI, these are what we consider "build time" and "design time" packages, rather than "run-time" packages which are web, auth, api, forms.)

In order to do that you use the `--cwd` option to set the current working directory to your "test project":

```terminal
yarn build
cd packages/cli
yarn dev --cwd /path/to/your/project
```
The `yarn dev` will run the built CLI, and the `--cwd` option will make the command run in that directory. Remember to rebuild the packages if you have made a change to the code! (Tip: You can use `yarn build:watch` to automatically build the framework whilst you're making changes.)

(Tip: --cwd is optional, it will reference the `__fixtures__/example-todo-main` project in the framework.)

#### Specifying a RW_PATH

You can avoid having to provide the path to `redwood` by defining an `RW_PATH` environment variable on your system.

##### On **Linux**

Add the following line to your `~/.bashrc`:

```terminal
export RW_PATH=”$HOME/path/to/redwood/framework”
```

Where `/path/to/redwood/framework` is replaced by the path to your local copy of the Redwood Framework.

Then, in your Redwood App or example app, you can just run:

```terminal
yarn rwt link
```

or

```terminal
yarn rwt copy:watch
```

##### On **MacOS**

Add the following line to your `~/.bash_profile`:

```terminal
export RW_PATH=”$HOME/path/to/redwood/framework”
```

Where `/path/to/redwood/framework` is replaced by the path to your local copy of the Redwood Framework.

Then, in your Redwood App or example app, you can just run:

```terminal
yarn rwt link
```

or

```terminal
yarn rwt copy:watch
```

##### On **Windows**

> **TODO**
>
> please contribute a PR if you can help.

### Local Package Registry Emulation

Sometimes you'll want to test the full package-development workflow: building, publishing, and installing all the packages in your local copy of the Redwood Framework in your Redwood App. We accommodate this using a local NPM registry called [**Verdaccio**](https://github.com/verdaccio/verdaccio).

You might also have to use this workflow if you've installed or upgraded one of Redwood's dependencies.

#### Running a Local NPM Registry

First, install `Verdaccio`:

```terminal
yarn global add verdaccio
```

Then, in your local copy of the Redwood Framework, run:

```terminal
./tasks/run-local-npm
```

This starts `Verdaccio` (on http://localhost:4873) with our configuration file.

#### Publishing a Package

To build, unpublish, and publish all the Redwood packages to your local NPM registry with a "dev" tag, run:

```terminal
./tasks/publish-local
```

> This script is equivalent to running:
>
> ```terminal
> npm unpublish --tag dev --registry http://localhost:4873/ --force
> npm publish --tag dev --registry http://localhost:4873/ --force
> ```

Note that you can build a particular package by specifying the path to the package: `./tasks/publish-local ./packages/api`. For example, if you've made changes to the `@redwoodjs/dev-server` package, you would run:

```terminal
./tasks/publish-local ./packages/dev-server
```

#### Installing Published Packages in Your Redwood App

The last step is to install the package into your Redwood App.

```terminal
yarn rwt install @redwoodjs/dev-server
```

> This is equivalent to running:
>
> ```terminal
> rm -rf <APP_PATH>/node_modules/@redwoodjs/dev-server
> yarn upgrade @redwoodjs/dev-server@dev --no-lockfile --registry http://localhost:4873/
> ```

## Running Your Redwood App's Local Server(s)

When developing Redwood Apps, you’re probably used to running both the API and Web servers with `yarn rw dev` and seeing your changes included immediately.

But for local package development, your changes won’t be included automatically&mdash;you'll need to manually stop/start the respective server to include them.

In this case you might find it more convenient to run the servers for each of the yarn workspaces independently:

```terminal
yarn rw dev api
yarn rw dev web
```

## Integration tests

We're using Cypress to test the steps that we recommend in the tutorial. Run the command by doing the following:

```terminal
./tasks/run-e2e
```

This creates a new project in a temporary directory using `yarn create redwood-app ...` Once installed, it then upgrades the project to the most recent `canary` release, which means it will use the current code in the `main` branch. Once the upgrade is complete (and successful), it will start Cypress for the E2E tests.


```terminal
./tasks/run-e2e /path/to/app
```

Use this `path/to/app` option to run the same Cypress E2E tests against a local project. In this case, the command will _not_ upgrade the project to the `canary` release — it will use the project's installed packages. Chose this option if you have modified code (and packages) you want to test locally.


> Windows Not Supported: The command for this is written in bash and will not work on Windows.

## Releases

To publish a new version of Redwood to NPM run the following commands:

> NOTE: `<version>` should be formatted `v0.24.0` (for example)

```bash
git clean -dfx
yarn install
./tasks/update-package-versions <version>
git commit -am "<version>"
git tag -am <version> "<version>"
git push && git push --tags
yarn build
yarn framework lerna publish from-package
```

This...
  1) changes the version of **all the packages** (even those that haven't changed),
  2) changes the version of the packages within the CRWA Template
  3) Commits, Tags, and Pushes to GH
  4) and finally publishes all packages to NPM.

### Troubleshooting

If something went wrong you can use `yarn lerna publish from-package` to publish the packages that aren't already in the registry.

## CLI Reference: `redwood-tools`


> This section covers the `redwood-tools` command options.
>
> For `redwood` options, see the [CLI Reference on redwoodjs.com](https://redwoodjs.com/reference/command-line-interface).

### redwood-tools (rwt)

Redwood's companion CLI development tool. You'll be using this if you're contributing to Redwood.

```
yarn rwt <command>
```

|Command | Description|
|:-|:-|
|`copy` | Copy the Redwood Framework path to this project.|
|`copy:watch` | Watch the Redwood Framework path for changes and copy them over to this project.|
|`fix-bins` | Fix Redwood symlinks and permissions.|
|`install` | Install a package from your local NPM registry.|
|`link` | Link the Redwood Framework path to this project and watch it for changes.|

### copy (cp)

Copy the Redwood Framework path to this project.

```terminal
yarn rwt cp [RW_PATH]
```

You can avoid having to provide `RW_PATH` by defining an environment variable on your system. See [Specifying a `RW_PATH`](#specifying-a-rw_path).

### copy:watch (cpw)

Watch the Redwood Framework path for changes and copy them over to this project.

```terminal
yarn rwt cpw [RW_PATH]
```

You can avoid having to provide `RW_PATH` by defining an environment variable on your system. See [Specifying a `RW_PATH`](#specifying-a-rw_path).

### fix-bins (fix)

Fix Redwood symlinks and permissions.

```terminal
yarn rwt fix
```

The Redwood CLI has the following binaries:

- `redwood`
- `rw`
- `redwood-tools`
- `rwt`
- `dev-server`

When you're contributing, the permissions of these binaries can sometimes get mixed up. This makes them executable again.

### install (i)

Install a package from your local NPM registry.

```terminal
yarn rwt i <packageName>
```

You'll use this command if you're testing the full package-development workflow. See [Local Package Registry Emulation](https://github.com/redwoodjs/redwood/blob/main/CONTRIBUTING.md#local-package-registry-emulation).

### link

Link the Redwood Framework path to this project and watch it for changes.

```terminal
yarn rwt link [RW_PATH]
```

You can avoid having to provide `RW_PATH` by defining an environment variable on your system. See
[Specifying a `RW_PATH`](#specifying-a-rw_path).
