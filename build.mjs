import { build } from 'vite';
import monkey from 'vite-plugin-monkey';
import { readdirSync, readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = 'C:\\Dev\\Projects\\tampermonkey-scripts';
const entryFiles = readdirSync(ROOT).filter(f => f.endsWith('.user.js'));

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
  const arrayKeys = new Set(['match', 'grant', 'connect', 'require', 'resource', 'include']);

  for (const line of block.split('\n')) {
    const kvMatch = line.match(/\/\/ @(\S+)\s+(.+)/);
    if (!kvMatch) continue;

    const key = kvMatch[1];
    let value = kvMatch[2].trim();

    if (value === '') continue;

    if (arrayKeys.has(key)) {
      if (!userscript[key]) userscript[key] = [];
      userscript[key].push(value);
    } else {
      // Only set if not already set (first occurrence wins for single-value keys)
      if (!(key in userscript)) {
        // Try to coerce common types
        if (value === 'true') value = true;
        else if (value === 'false') value = false;
        userscript[key] = value;
      }
    }
  }

  // Filter out @require — all modules are inlined by the build, no external deps.
  delete userscript.require;

  return userscript;
}

console.log(`Found ${entryFiles.length} entry scripts:\n`);

let successCount = 0;
let failCount = 0;

for (const entry of entryFiles) {
  const entryPath = resolve(ROOT, entry);
  const userscript = parseUserscriptBlock(entryPath);

  if (!userscript.name) {
    console.warn(`  WARN: No @name found in "${entry}" — skipping.`);
    failCount++;
    continue;
  }

  console.log(`Building: ${entry} (${userscript.name})`);

  try {
    await build({
      root: ROOT,
      plugins: [
        monkey({
          entry: entryPath,
          userscript,
          build: {
            fileName: entry,
            metaFileName: true,
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
    successCount++;
  } catch (err) {
    console.error(`  FAILED: ${entry}`);
    console.error(`    ${err.message}`);
    failCount++;
  }

  console.log('');
}

console.log(`Done. ${successCount} built, ${failCount} failed.`);
