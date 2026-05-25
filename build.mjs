import { build } from 'vite';
import monkey from 'vite-plugin-monkey';
import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = 'C:\\Dev\\Projects\\tampermonkey-scripts';
const ENTRIES_DIR = 'C:\\Dev\\Projects\\tampermonkey-scripts\\entries';
const entryFiles = readdirSync(ENTRIES_DIR).filter(f => f.endsWith('.user.js'));

/**
 * Parse the // ==UserScript== block from an entry file into the
 * vite-plugin-monkey `userscript` option format.
 *
 * Handles:
 *   - Single-value keys (name, version, description, etc.)
 *   - Multi-value keys (@match, @grant, @connect are arrays)
 *   - i18n keys (name:de, description:de)
 */
function parseUserscriptBlock(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const match = content.match(/\/\/ ==UserScript==\n([\s\S]*?)\n\/\/ ==\/UserScript==/);
  if (!match) return {};

  const block = match[1];
  const userscript = {};
  const arrayKeys = new Set(['match', 'grant', 'connect', 'require', 'resource', 'include', 'antifeature']);

  for (const line of block.split('\n')) {
    // Match both valued keys (@name ...) and value-less flags (@noframes, @unwrap)
    const kvMatch = line.match(/\/\/ @(\S+)(?:\s+(.+))?$/);
    if (!kvMatch) continue;

    const key = kvMatch[1];
    // Value-less keys (e.g. @noframes) get value true
    let value = kvMatch[2] !== undefined ? kvMatch[2].trim() : true;

    if (value === '') continue;

    // Handle i18n keys: "name:de" → nested under name object as { de: "..." }.
    // The plugin expects name/description to be objects with locale keys.
    const colonIdx = key.indexOf(':');
    if (colonIdx !== -1) {
      const baseKey = key.slice(0, colonIdx);
      const locale = key.slice(colonIdx + 1);

      // Only name and description support i18n in userscript metadata.
      // Other colon-keys like @run-at are kept as-is.
      if (baseKey === 'name' || baseKey === 'description') {
        if (typeof userscript[baseKey] === 'string') {
          userscript[baseKey] = { '': userscript[baseKey] };
        }
        if (typeof userscript[baseKey] !== 'object' || userscript[baseKey] === null) {
          userscript[baseKey] = {};
        }
        userscript[baseKey][locale] = value;
        continue;
      }
    }

    if (arrayKeys.has(key)) {
      if (!userscript[key]) userscript[key] = [];
      userscript[key].push(value);
    } else {
      // Only set if not already set (first occurrence wins for single-value keys)
      if (!(key in userscript)) {
        if (value === 'true') value = true;
        else if (value === 'false') value = false;
        userscript[key] = value;
      }
    }
  }

  // Filter out local @require — project modules are inlined by the build.
  // Keep external CDN URLs (http/https) for runtime dependencies like marked.js.
  if (userscript.require) {
    userscript.require = userscript.require.filter(r => /^https?:\/\//.test(r));
    if (userscript.require.length === 0) delete userscript.require;
  }

  return userscript;
}

console.log(`Found ${entryFiles.length} entry scripts:\n`);

let successCount = 0;
let failCount = 0;

for (const entry of entryFiles) {
  const entryPath = resolve(ENTRIES_DIR, entry);
  const userscript = parseUserscriptBlock(entryPath);

  if (!userscript.name) {
    console.warn(`  WARN: No @name found in "${entry}" — skipping.`);
    failCount++;
    continue;
  }

  const displayName = typeof userscript.name === 'object' ? (userscript.name[''] || userscript.name) : userscript.name;
  console.log(`Building: ${entry} (${displayName})`);

  try {
    await build({
      root: ROOT,
      plugins: [
        monkey({
          entry: entryPath,
          userscript,
          build: {
            fileName: entry,
            metaFileName: false,
          },
        }),
      ],
      build: {
        outDir: 'dist',
        emptyOutDir: false,
        minify: false,
      },
      logLevel: 'warn',
    });

    console.log(`  -> dist/${entry}`);

    // Strip stray @license comments from inside the IIFE body.
    // vite-plugin-monkey preserves the @license line from the entry file's
    // userscript block as a regular comment in the bundled output (non-minified).
    // This removes any @license comment after the ==/UserScript== header boundary.
    const distPath = resolve('dist', entry);
    let distContent = readFileSync(distPath, 'utf-8');
    const headerEnd = distContent.indexOf('\n// ==/UserScript==');
    if (headerEnd !== -1) {
      const header = distContent.slice(0, headerEnd + 21);
      const body = distContent.slice(headerEnd + 21);
      distContent = header + body.replace(/\/\/ @license\s+.*$/gm, '');
      writeFileSync(distPath, distContent, 'utf-8');
    }

    successCount++;
  } catch (err) {
    console.error(`  FAILED: ${entry}`);
    console.error(`    ${err.message}`);
    failCount++;
  }

  console.log('');
}

console.log(`Done. ${successCount} built, ${failCount} failed.`);
