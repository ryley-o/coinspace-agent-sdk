#!/usr/bin/env node
// Changesets' own `publish-script` (see .github/workflows/publish.yml). Neither `pnpm publish`
// nor changesets' own built-in publish path is used here, on purpose: this repo needs npm's
// Trusted Publishing (OIDC) handshake, which only the `npm` CLI itself speaks -- `pnpm publish`
// doesn't (confirmed against pnpm's own docs/changelog, no mention of OIDC/trusted-publishing
// support as of pnpm 12). `pnpm pack` still does the one thing that's actually needed from pnpm
// here -- it resolves the `workspace:*` dependency between these two packages into the real,
// currently-declared version, the same way it would for `pnpm publish` -- so the two-step
// "pnpm pack, then npm publish the resulting tarball" is the combination that gets both properties
// at once. Same pattern this session already hand-ran once successfully for the bootstrap publish.
import { execSync } from "node:child_process";
import { readFileSync, readdirSync, unlinkSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const packagesDir = join(dirname(fileURLToPath(import.meta.url)), "..", "packages");

// sdk first -- by the time cli publishes, the sdk version it depends on already exists on the
// registry for anyone installing it. Not load-bearing for `pnpm pack` itself (that resolves the
// workspace-local version regardless of what's on the registry), just a cleaner install experience.
const ORDER = ["sdk", "cli"];

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
}
