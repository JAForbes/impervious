# superlib

⛅ A little template for writing simple libraries with typescript.

## Quick Start

```bash
# Clone's the repo without initializing a repository
npx degit JAForbes/superlib your-package-name

# Jump in the directory
cd your-package-name

# Install the deps
npm install
```

## Remame your package:

Do a global search and replace for impervious with your desired package name.

## Test

Tests use `node:test`, the new built in test runner in node.

To run tests in --watch mode use:

```
npm run dev
```

## CI

Github actions are preconfigured so your tests and your type build will run on every push

## Build

To build run `npm run build`, your library will have type definitions generated by tsc, and an esm bundly generated by esbuild.

## Publish

To publish run `npm run publish` (make sure you've changed the package name from the default!)

By default the package.json is configured to generate a new prerelease version and publish to `next` instead of `latest`.

Somewhat confusingly, the incrementing of the version occurs after the version config is retrieved by `publish`, but its fine, its incremented for next time.

As your library matures you'll likely remove the auto versioning and the defaulted `publishConfig`.