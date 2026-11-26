#!/usr/bin/env node
// Validates the skills in this repo and builds the release index. No dependencies.
//   node scripts/skills.mjs check          spec and safety rules; tools must exist in the live Webz.io catalog
//   node scripts/skills.mjs index v1.2.3   writes skills.json for that release tag
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = 'https://github.com/Webhose/skills';
const CATALOG = 'https://mcp.webz.io/catalog.json';
const KEYS = ['name', 'description', 'license', 'compatibility', 'metadata', 'allowed-tools'];

// YAML reads these plain values as booleans, nulls, numbers or dates, not as text.
const NOT_TEXT = /^(true|false|yes|no|on|off|null|[\d._eE+:-]+)$/i;
// Characters a reviewer cannot see: controls, format and bidi marks, tag characters, variation selectors, fillers.
const HIDDEN = /(?![\n\t])[\p{Cc}\p{Cf}\p{Co}\p{Cn}\p{Variation_Selector}\u115F\u1160\u3164\uFFA0\uFFFD]/gu;
const SECRETS = [
  /\b[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\b/gi, // UUID, the shape of a Webz.io API token
  /\b(?:sk|pk|rk)[-_][\w-]{20,}|\bgh[pousr]_\w{20,}|\bgithub_pat_\w{20,}|\bxox[abprs]-[\w-]{10,}|\bAKIA[0-9A-Z]{16}\b|\beyJ[\w-]{10,}\.[\w-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY-----/g,
  /\b(?=\w*\d)(?=\w*[A-Za-z])\w{32,}\b/g, // any long run that mixes letters and digits
];

function scalar(key, raw) {
  if (/^"[^"\\]*"$/.test(raw)) return raw.slice(1, -1);
  if (!/^[A-Za-z0-9]/.test(raw) || /: | #|:$|\s$/.test(raw) || NOT_TEXT.test(raw)) {
    throw new Error(`${key}: use plain text, or wrap it in double quotes (no " or \\ inside)`);
  }
  return raw;
}

// ponytail: reads only `key: value` lines and one nested map (metadata). Everything else YAML allows (lists, block
// scalars, comments, escapes) is rejected, so a file that passes reads the same in every agent's YAML parser.
// Upgrade path: a YAML dependency.
export function parseSkill(text) {
  const parts = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text);
  if (!parts) throw new Error('must start with a frontmatter block between two --- lines');
  const meta = {};
  let map;
  for (const line of parts[1].split('\n')) {
    const found = /^( {2})?([A-Za-z][\w-]*):(?: (.*))?$/.exec(line);
    const [, nested, key, raw] = found ?? [];
    if (!found || (nested && (!map || raw === undefined))) throw new Error(`unsupported frontmatter line: ${line}`);
    const target = nested ? map : meta;
    if (Object.hasOwn(target, key)) throw new Error(`duplicate frontmatter key: ${key}`);
    target[key] = raw === undefined ? {} : scalar(key, raw);
    if (!nested) map = raw === undefined ? target[key] : undefined;
  }
  return { meta, body: parts[2] };
}

export const toolsOf = (meta) => (meta.metadata?.['webz-tools'] ?? '').split(/\s+/).filter(Boolean);

function allowedLink(link) {
  try {
    const url = new URL(link.replace(/^www\./i, 'https://www.'));
    const webz = url.hostname === 'webz.io' || url.hostname.endsWith('.webz.io');
    const ours = url.hostname === 'github.com' && url.pathname.toLowerCase().startsWith('/webhose/');
    return url.protocol === 'https:' && !url.username && (webz || ours);
  } catch {
    return false;
  }
}

// Safety rules for any Markdown file under skills/: nothing hidden from a reviewer, nothing that leaves Webz.io.
export function checkContent(text) {
  const errors = [];
  const at = (match) => `line ${text.slice(0, match.index).split('\n').length}`;
  for (const match of text.matchAll(HIDDEN)) {
    const code = match[0].codePointAt(0).toString(16).toUpperCase().padStart(4, '0');
    errors.push(`${at(match)}: hidden or control character U+${code}`);
  }
  // ponytail: code is blanked with a simple fence and single-backtick match; nested or double-backtick spans are not handled.
  const prose = text.replace(/```[\s\S]*?```|`[^`\n]*`/g, (code) => code.replace(/[^\n]/g, ' '));
  for (const match of prose.matchAll(/<!--|<\/?[A-Za-z][\w-]*(?=[\s/>])[^>\n]*>/g)) {
    errors.push(`${at(match)}: raw HTML outside code: ${match[0]}`);
  }
  for (const match of text.matchAll(/\b(?:[a-z][a-z0-9+.-]*:\/\/|www\.)[^\s<>()[\]"'`]+/gi)) {
    if (!allowedLink(match[0])) errors.push(`${at(match)}: link outside webz.io and github.com/Webhose: ${match[0]}`);
  }
  for (const match of text.matchAll(/\]\(\s*<?\s*(?:\/\/|(?!https:)[a-z][a-z0-9+.-]*:)/gi)) {
    errors.push(`${at(match)}: a link target must be https or a relative path`);
  }
  for (const pattern of SECRETS) {
    for (const match of text.matchAll(pattern)) errors.push(`${at(match)}: looks like a token or key: ${match[0].slice(0, 8)}...`);
  }
  return errors;
}

// Agent Skills spec rules for one SKILL.md, plus: every tool it names exists in the catalog (a Set of tool names).
export function checkSkill(dir, text, catalog) {
  let skill;
  try {
    skill = parseSkill(text);
  } catch (error) {
    return [error.message];
  }
  const { meta, body } = skill;
  const { name, description, compatibility = '' } = meta;
  const errors = [];
  for (const [key, value] of Object.entries(meta)) {
    if (!KEYS.includes(key)) errors.push(`unknown frontmatter key: ${key}`);
    else if ((key === 'metadata') !== (typeof value === 'object')) errors.push(`${key}: ${key === 'metadata' ? 'must be a map' : 'must be one value'}`);
  }
  if (typeof name !== 'string' || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name) || name.length > 64) {
    errors.push('name: required, 1 to 64 lowercase letters, digits and single hyphens');
  } else if (name !== dir) errors.push(`name "${name}" must equal its directory "${dir}"`);
  if (typeof description !== 'string' || !description || description.length > 1024) errors.push('description: required, at most 1024 characters');
  if (compatibility.length > 500) errors.push('compatibility: at most 500 characters');
  if (body.split('\n').length > 500) errors.push('body: keep it under 500 lines');
  const unknown = toolsOf(meta).filter((tool) => !catalog.has(tool));
  if (unknown.length) errors.push(`metadata.webz-tools: not in the Webz.io catalog: ${unknown.join(', ')}`);
  return errors;
}

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    // A symlink is neither a directory nor a file here, so it is reported as not Markdown.
    return entry.isDirectory() ? walk(path) : [{ path, markdown: entry.isFile() && entry.name.endsWith('.md') }];
  });
}

function skillFiles(root) {
  return readdirSync(join(root, 'skills'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({ dir: entry.name, path: join(root, 'skills', entry.name, 'SKILL.md') }))
    .sort((a, b) => a.dir.localeCompare(b.dir));
}

export function checkRepo(root, catalog) {
  const errors = [];
  const report = (path, found) => errors.push(...found.map((error) => `${relative(root, path)}: ${error}`));
  const readme = readFileSync(join(root, 'README.md'), 'utf8');
  for (const { path, markdown } of walk(join(root, 'skills'))) {
    report(path, markdown ? checkContent(readFileSync(path, 'utf8')) : ['only Markdown files belong under skills/ (no scripts, binaries or links)']);
  }
  for (const { dir, path } of skillFiles(root)) {
    if (!existsSync(path)) report(path, ['missing']);
    else report(path, checkSkill(dir, readFileSync(path, 'utf8'), catalog));
    if (!readme.includes(`skills/${dir}/`)) report(path, ['not listed in README.md']);
  }
  return errors;
}

export function buildIndex(root, tag) {
  const skills = skillFiles(root).map(({ dir, path }) => {
    const { meta } = parseSkill(readFileSync(path, 'utf8'));
    return {
      name: dir,
      description: meta.description,
      tools: toolsOf(meta),
      source: `${REPO}/blob/${tag}/skills/${dir}/SKILL.md`,
      raw: `${REPO.replace('github.com', 'raw.githubusercontent.com')}/${tag}/skills/${dir}/SKILL.md`,
      docs: `https://docs.webz.io/docs/webz/skill-${dir}`,
    };
  });
  return { version: tag.slice(1), repository: REPO, skills };
}

async function main([command, tag]) {
  if (command === 'check') {
    let response = await fetch(CATALOG);
    if (!response.ok) {
      // One retry: the catalog can answer a passing 429, and a release must not stop on it after its tag is pushed.
      await new Promise((resolve) => setTimeout(resolve, 10_000));
      response = await fetch(CATALOG);
    }
    if (!response.ok) throw new Error(`${CATALOG}: HTTP ${response.status}`);
    const { products } = await response.json();
    const errors = checkRepo(ROOT, new Set(products.flatMap((product) => product.tools.map((tool) => tool.name))));
    errors.forEach((error) => console.error(error));
    if (errors.length) process.exit(1);
    console.log(`${skillFiles(ROOT).length} skills OK`);
  } else if (command === 'index' && /^v\d+\.\d+\.\d+$/.test(tag ?? '')) {
    writeFileSync(join(ROOT, 'skills.json'), `${JSON.stringify(buildIndex(ROOT, tag), null, 2)}\n`);
  } else {
    console.error('Usage: node scripts/skills.mjs check | index vX.Y.Z');
    process.exit(2);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error.message, error.cause ?? '');
    process.exit(1);
  });
}
