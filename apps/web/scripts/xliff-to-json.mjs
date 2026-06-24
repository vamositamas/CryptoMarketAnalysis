#!/usr/bin/env node
/**
 * Converts an XLIFF 1.2 file into a JSON file suitable for Angular's
 * loadTranslations() runtime API.
 *
 * Usage: node xliff-to-json.mjs <input.xlf> <output.json>
 *
 * XLIFF <x id="TAG_INPUT"/> placeholders are converted to {$TAG_INPUT}.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const [, , inputPath, outputPath] = process.argv;
if (!inputPath || !outputPath) {
  console.error('Usage: xliff-to-json.mjs <input.xlf> <output.json>');
  process.exit(1);
}

const xml = readFileSync(inputPath, 'utf8');

/** Convert a <target>...</target> inner XML string to an Angular runtime translation string. */
function targetToTranslation(inner) {
  return inner
    .replace(/<x\s+id="([^"]+)"[^>]*\/>/g, (_, id) => `{$${id}}`)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .trim();
}

const translations = {};

// Match each trans-unit block
const unitRe = /<trans-unit\s+id="([^"]+)"[^>]*>([\s\S]*?)<\/trans-unit>/g;
let unitMatch;
while ((unitMatch = unitRe.exec(xml)) !== null) {
  const id = unitMatch[1];
  const body = unitMatch[2];

  // Extract target content
  const targetMatch = /<target[^>]*>([\s\S]*?)<\/target>/i.exec(body);
  if (!targetMatch) continue;

  const translation = targetToTranslation(targetMatch[1]);
  if (translation) {
    translations[id] = translation;
  }
}

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, JSON.stringify(translations, null, 2), 'utf8');
console.log(`Wrote ${Object.keys(translations).length} translations → ${outputPath}`);
