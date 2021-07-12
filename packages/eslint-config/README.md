# ESLint Config

<!-- toc -->
- [ESLint Config](#eslint-config)
  - [Purpose and Vision](#purpose-and-vision)
  - [Package Leads](#package-leads)
  - [Roadmap](#roadmap)
  - [Contributing](#contributing)
  - [Overriding Default Configuration](#overriding-default-configuration)

## Purpose and Vision

This package contains a shareable set of ESLint rules and configuration that can be re-used on all RedwoodJS projects. The framework [`eslint-config`](https://github.com/redwoodjs/redwood/tree/main/packages/eslint-config) package is used both for framework configuration and RedwoodJS app (created with the [CRWA](https://github.com/redwoodjs/redwood/tree/main/packages/create-redwood-app) package) configuration.

Our configuration uses recommended rule presets, including those from [ESLint](https://eslint.org/docs/rules/), [React](https://www.npmjs.com/package/eslint-plugin-react#list-of-supported-rules), the [Rules of Hooks](https://reactjs.org/docs/hooks-rules.html), and [Jest](https://github.com/testing-library/eslint-plugin-jest-dom#supported-rules). We also override the presets with some stylistic preferences. Some of them are:

- [No semicolons](https://eslint.org/docs/rules/semi) at the end of statements
- [Trailing commas](https://eslint.org/docs/rules/comma-dangle) in object and array literals
- [Use single quotes](https://eslint.org/docs/rules/quotes) on strings wherever possible
- [Use parentheses](https://eslint.org/docs/rules/arrow-parens)  around arrow function parameters
- [Sort import declarations](https://eslint.org/docs/rules/sort-imports) by name
- [Wrap block statements](https://eslint.org/docs/rules/curly) in curly braces

## Package Leads

Peter Pistorius (@peterp), David Price (@thedavidprice), Dominic Saadi (@jtoar), Daniel Choudhury (@dac09)

## Roadmap

- Lint for case-sensitive imports (issue [#2806](https://github.com/redwoodjs/redwood/issues/2806))

## Contributing

This package has no dependencies on other Redwood Framework packages. To contribute, you should be familiar with the ESLint package. Keep in mind that any rules added should not conflict with code formatting tools (e.g. [Prettier](https://prettier.io/docs/en/integrating-with-linters.html)).

## Overriding Default Configuration

In a Redwood App, you can override default config in your root `package.json` file by adding the rules after the include for this package:

```javascript
// redwood/package.json
"eslintConfig": {
  "extends": "@redwoodjs/eslint-config",
  "root": true,
  "jsx-a11y/no-onchange": "off",
},
```

If you need script in your configuration, you can remove the `eslintConfig` block from your root `package.json` file and add an `.eslintrc.js` file:

```javascript
// redwood/.eslintrc.js
module.exports = {
  extends: ['@redwoodjs/eslint-config'],
  'root': true,
  rules: {
    'jsx-a11y/no-onchange': 'off',
  },
}
```

By default, ESLint will recurse through all project directories looking for configuration files and directives, and overriding those specified in multiple places according to a prioritization formula. The `root` directive tells ESLint to stop searching for configuration lower in the tree at the file this directive is encountered.

In a different Redwood Framework package or in a Redwood App, you can provide configuration that applies only to that package or side by omitting the `root` directive. For example, to apply a directive only to the client code of an app:

```javascript
// e.g. redwood/packages/auth or redwood-app/web/package.json
"eslintConfig": {
  "jsx-a11y/no-onchange": "off",
},
```

In this case, ESLint will still load the configuration from the `@redwoodjs/eslint-config` package as the default value of `root` is `false`.
