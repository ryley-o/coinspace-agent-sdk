# Releasing

`packages/sdk` and `packages/cli` are versioned and published via
[Changesets](https://github.com/changesets/changesets), fully automated after one manual step per
PR.

## Making a change that should ship

1. Make your change to `packages/sdk` and/or `packages/cli`.
2. Describe it:
   ```bash
   pnpm changeset
   ```
   Pick which package(s) changed, the bump type (patch/minor/major -- if you change the SDK in a
   way the CLI depends on, changesets bumps the CLI's dependency on it too, since
   `updateInternalDependencies` is set to `"patch"` in `.changeset/config.json`), and write a
   one-line summary. This writes a markdown file under `.changeset/` -- commit it alongside your
   code change, in the same PR.
3. Merge to `main` as normal.

## What happens after that

On every push to `main`, [`.github/workflows/publish.yml`](.github/workflows/publish.yml) runs:

- **If there are pending changesets** (i.e. your PR from above just merged): it opens or updates a
  bot-authored **"Version Packages" PR** that bumps the affected package(s)' versions, updates
  their `CHANGELOG.md`, and consumes the changeset files. Nothing is published yet at this point --
  review it like any other PR.
- **Merging that PR** triggers the workflow again, this time with no pending changesets left, so it
  runs the actual publish (`scripts/publish-packages.mjs` -- see that file for why it's a custom
  script rather than changesets' own built-in publish step: npm's Trusted Publishing/OIDC needs the
  raw `npm` CLI, but the `workspace:*` dependency between these two packages needs `pnpm pack` to
  resolve first, and neither tool alone does both).

No npm token or OTP is ever needed for this -- publishing authenticates via npm's Trusted
Publishing (OIDC), scoped to this exact repo and this exact workflow file. If a package's current
`package.json` version is already live on the registry, the script skips it rather than failing,
so one shared release PR bumping only one of the two packages is fine.

## Manual/emergency publish

If you ever need to bypass the automation (rare): `pnpm run release` runs the same publish script
locally, provided you're authenticated with `npm login` (or have a 2FA-capable session) yourself.
