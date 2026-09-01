#!/usr/bin/env node
// Concatenates every app/**/page.mdx into public/llms-full.txt -- the "everything, verbatim" llms.txt
// companion (the plain llms.txt is a curated index; this is the actual content, for an agent that
// wants to load the whole site in one fetch rather than following links). Runs as part of `build`
// so it can never silently drift from the real pages the way a hand-maintained copy would.
import { readFile, writeFile, readdir } from "node:fs/promises";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const appDir = join(__dirname, "..", "app");
const outFile = join(__dirname, "..", "public", "llms-full.txt");

async function findPages(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const pages = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) pages.push(...(await findPages(full)));
    else if (entry.name === "page.mdx") pages.push(full);
  }
  return pages;
}

function routeOf(pageFile) {
  const rel = relative(appDir, dirname(pageFile)).replace(/\\/g, "/");
  return rel === "." ? "/" : `/${rel}`;
}

function stripFrontmatter(content) {
  return content.replace(/^---\n[\s\S]*?\n---\n/, "").trim();
}

const pages = (await findPages(appDir)).sort((a, b) => routeOf(a).localeCompare(routeOf(b)));

const sections = await Promise.all(
  pages.map(async (page) => {
    const raw = await readFile(page, "utf8");
    const route = routeOf(page);
    const body = stripFrontmatter(raw);
    return `# https://docs.coinspace.social${route === "/" ? "" : route}\n\n${body}`;
  }),
);

const header = `# CoinSpace Agent SDK -- full content\n\nEvery page on docs.coinspace.social, concatenated, generated from source at build time (see apps/docs/scripts/generate-llms-full.mjs). See /llms.txt for a curated index instead.\n\n`;

await writeFile(outFile, header + sections.join("\n\n---\n\n") + "\n");
console.log(`wrote ${outFile} (${pages.length} pages)`);
