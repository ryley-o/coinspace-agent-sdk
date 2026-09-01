#!/usr/bin/env node
// Changesets' own `publish-script` (see .github/workflows/publish.yml). Neither `pnpm publish`
// nor changesets' own built-in publish path is used here, on purpose: this repo needs npm's
// Trusted Publishing (OIDC) handshake, which only the `npm` CLI itself speaks -- confirmed by
// reading @changesets/cli's own source (getPublishPlan.mjs): in a pnpm workspace it always shells
// out to `pnpm publish`, never plain `npm publish`, and pnpm doesn't support OIDC as of pnpm 12
// (no mention in its docs/changelog). `pnpm pack` still does the one thing that's actually needed
// from pnpm here -- it resolves the `workspace:*` dependency between these two packages into the
// real, currently-declared version, the same way `pnpm publish` would -- so "pnpm pack, then npm
// publish the resulting tarball" is the combination that gets both properties at once. Confirmed
// empirically against the real registry: @coinspace-social/cli's published dependency on
// agent-sdk is a real "0.1.0", not the literal workspace:* string.
//
// Also writes CHANGESETS_OUTPUT (an NDJSON report, one line per published package) if that env
// var is set -- changesets/action reads it to know what actually got published, so it can create
// the matching git tags and GitHub Releases itself. Without this, publishing still works, it just
// silently skips that part (confirmed live: the workflow run without this warned "GitHub releases
// and git tags cannot be created without this output"). The exact `{type: "git-tag", tag,
// packageName}` shape and `name@version` tag format are taken directly from @changesets/cli's own
// source (dist/usingCtx.mjs's createOutputReport, dist/gitTags.mjs's buildGitTag) -- this script
// doesn't create the tags itself, just reports what to tag, same division of labor changesets'
// own publish command uses internally (it reports, the surrounding action/git layer acts on it).
import { execSync } from "node:child_process";
import { appendFileSync, mkdirSync, readFileSync, readdirSync, unlinkSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const packagesDir = join(dirname(fileURLToPath(import.meta.url)), "..", "packages");

// sdk first -- by the time cli publishes, the sdk version it depends on already exists on the
// registry for anyone installing it. Not load-bearing for `pnpm pack` itself (that resolves the
// workspace-local version regardless of what's on the registry), just a cleaner install experience.
const ORDER = ["sdk", "cli"];

const outputPath = process.env.CHANGESETS_OUTPUT;
if (outputPath) mkdirSync(dirname(outputPath), { recursive: true });

function reportPublished(name, version) {
  if (!outputPath) return;
  appendFileSync(outputPath, `${JSON.stringify({ type: "git-tag", tag: `${name}@${version}`, packageName: name })}\n`);
}

function alreadyPublished(name, version) {
  try {
    execSync(`npm view ${name}@${version} version`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

for (const dir of ORDER) {
  const pkgDir = join(packagesDir, dir);
  const pkg = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8"));
  if (pkg.private) continue;

  if (alreadyPublished(pkg.name, pkg.version)) {
    console.log(`${pkg.name}@${pkg.version} is already published -- skipping.`);
    continue;
  }

  console.log(`\nPublishing ${pkg.name}@${pkg.version}...`);
  execSync("pnpm pack", { cwd: pkgDir, stdio: "inherit" });
  const tarball = readdirSync(pkgDir).find((f) => f.endsWith(".tgz"));
  if (!tarball) throw new Error(`pnpm pack didn't produce a .tgz in ${pkgDir}`);
  execSync(`npm publish ${tarball} --provenance`, { cwd: pkgDir, stdio: "inherit" });
  unlinkSync(join(pkgDir, tarball));
  reportPublished(pkg.name, pkg.version);
}
