# Release Notes

This script builds release notes for a milestone:

```
yarn build:release-notes v0.34.0
# there should be a new file at ./tasks/release-notes/v0.34.0-release-notes.md
```

To run this script, you'll need a personal access token. Provision one from https://github.com/settings/tokens and set it to `GITHUB_TOKEN` in your env.
