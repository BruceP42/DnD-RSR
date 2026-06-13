/* ---------------------------------------------------------
   Path:         runtime/js/writers/writer-utils.js
   File:         writer-utils.js
   Version:      V1.1
   Data Schema:  n/a
   System:       D&D Reference System (RSR)
   Module/Role:  Shared utilities for all domain writers
   Dependencies: data-paths.js
   Created:      2026-05-08
   Last Updated: 2026-05-10
--------------------------------------------------------- */
/* Changelog:
   V1.1:
   - Added replaceEntry(fileContent, idValue, newEntryStr) — locates an
     existing entry by id using a string-aware brace scanner and substitutes
     the new entry text in place. Trailing-comma normalisation applied to
     the replacement so both pipeline (unquoted keys) and runtime (quoted
     keys) files are handled uniformly.
   - Added private helpers _findEntryBounds() and _matchingClose() that
     power replaceEntry(). Not exported.
   V1.0:
   - Initial creation. Consolidates counter-read, pipeline-file-read,
     runtime-file-read, entry-append, new-file scaffold, and regex-escape
     logic extracted from spells-writer, magic-items-writer, and
     monsters-writer.
*/

import {
  getCounterPath,
  parseCounter,
  bootstrapHighest,
} from './data-paths.js';

// ── Counter ────────────────────────────────────────────────────────────────────

/**
 * Reads the global ID counter from the Flask server.
 * Bootstraps from runtime datasets if the counter file is missing (404).
 * Returns the current highest ID number.
 *
 * @param {string} server - Base URL of the Flask server (e.g. 'http://localhost:5000').
 * @returns {Promise<number>}
 * @throws {Error} On any HTTP error other than 404.
 */
export async function readCounter(server) {
  const counterPath = getCounterPath();
  const res = await fetch(`${server}/${counterPath}`);

  if (res.ok) {
    return parseCounter(await res.text());
  }
  if (res.status === 404) {
    return bootstrapHighest(server);
  }
  throw new Error(
    `Cannot read ID counter at ${counterPath}. ` +
    `Is the Flask server running? (HTTP ${res.status})`
  );
}

// ── File reads ─────────────────────────────────────────────────────────────────

/**
 * Reads a pipeline raw file from the Flask server.
 * Returns the file content as a string, or null if the file does not
 * exist yet (404). Throws on any other HTTP error.
 *
 * @param {string} server - Base URL of the Flask server.
 * @param {string} path   - Path relative to the project root.
 * @returns {Promise<string|null>}
 */
export async function readPipelineFile(server, path) {
  const res = await fetch(`${server}/${path}`);
  if (res.ok)             return res.text();
  if (res.status === 404) return null;
  throw new Error(
    `Cannot read pipeline file at ${path}. (HTTP ${res.status})`
  );
}

/**
 * Reads a runtime dataset file from the Flask server.
 * Returns the file content as a string.
 * Throws on any HTTP error including 404.
 *
 * @param {string} server - Base URL of the Flask server.
 * @param {string} path   - Path relative to the project root.
 * @returns {Promise<string>}
 */
export async function readRuntimeFile(server, path) {
  const res = await fetch(`${server}/${path}`);
  if (!res.ok) {
    throw new Error(
      `Cannot read runtime dataset at ${path}. ` +
      `Is the Flask server running? (HTTP ${res.status})`
    );
  }
  return res.text();
}

// ── File content helpers ───────────────────────────────────────────────────────

/**
 * Appends a serialized entry into an existing file's export default array.
 * Uses lastIndexOf(']; ') to find the insertion point. Ensures the
 * preceding entry has a trailing comma. Returns the updated file content.
 * Throws if ']; ' cannot be located.
 *
 * @param {string} fileContent - Full current file text.
 * @param {string} entryStr    - Serialized entry to insert.
 * @returns {string} Updated file content.
 * @throws {Error} If `];` cannot be located.
 */
export function appendEntry(fileContent, entryStr) {
  const lastClose = fileContent.lastIndexOf('];');
  if (lastClose === -1) {
    throw new Error(
      'Could not locate closing `];` in file content. The file may be malformed.'
    );
  }
  const before    = fileContent.slice(0, lastClose).trimEnd();
  const withComma = before.endsWith(',') ? before : before + ',';
  return withComma + '\n' + entryStr + '\n];\n';
}

/**
 * Replaces an existing entry (identified by id) inside a JS export default
 * array. Works for both pipeline raw files (unquoted keys) and runtime
 * dataset files (quoted keys).
 *
 * A string-aware brace scanner is used so that brace characters inside
 * string literals are never miscounted. The scanner handles escaped
 * characters inside double-quoted strings.
 *
 * Trailing-comma contract: replaceEntry always emits exactly one comma
 * after the replacement entry, consuming the original trailing comma when
 * present. newEntryStr may include or omit its own trailing comma — the
 * function normalises either form.
 *
 * @param {string} fileContent  - Full current file text.
 * @param {string} idValue      - The id to locate (e.g. "sp-hcs-3").
 * @param {string} newEntryStr  - Replacement entry text (the { ... } block).
 * @returns {string}            - Updated file content.
 * @throws {Error}              - If the id cannot be found, or the file is
 *                                malformed (unmatched braces, missing '[').
 */
export function replaceEntry(fileContent, idValue, newEntryStr) {
  const { start, end } = _findEntryBounds(fileContent, idValue);

  // Consume the trailing comma after the closing }, if present.
  // Whitespace between } and , is allowed (rare but possible).
  let replaceEnd = end;
  let j = end + 1;
  while (j < fileContent.length &&
         (fileContent[j] === ' ' || fileContent[j] === '\t')) {
    j++;
  }
  if (fileContent[j] === ',') replaceEnd = j;

  // Normalise newEntryStr: always emit exactly one trailing comma.
  const trimmed   = newEntryStr.trimEnd();
  const withComma = trimmed.endsWith(',') ? trimmed : trimmed + ',';

  return fileContent.slice(0, start) + withComma + fileContent.slice(replaceEnd + 1);
}

/**
 * Builds the full content for a brand-new pipeline source file.
 * Used when the pipeline file for a given sourceId does not exist yet.
 *
 * @param {string} sourceId - Source identifier (e.g. 'hcs').
 * @param {string} domain   - Domain name (e.g. 'spells', 'monsters').
 * @param {string} entryStr - Serialized first entry.
 * @returns {string}
 */
export function buildNewPipelineFile(sourceId, domain, entryStr) {
  return [
    `// pipeline/data/raw/${domain}-${sourceId}.js`,
    `// RAW DATASET — EDITABLE`,
    `export default [`,
    entryStr,
    `];`,
    '',
  ].join('\n');
}

// ── String helpers ─────────────────────────────────────────────────────────────

/**
 * Escapes special regex characters in a string.
 * Used when building a regex from user-supplied data.
 *
 * @param {string} str
 * @returns {string}
 */
export function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── Private helpers for replaceEntry ──────────────────────────────────────────

/**
 * Scans the array content of fileContent (starting after the first '[')
 * to find the entry whose id field matches idValue.
 *
 * Matches both quoted ("id": "value") and unquoted (id: "value") forms
 * so it works across pipeline raw files and runtime dataset files.
 *
 * @param {string} fileContent
 * @param {string} idValue
 * @returns {{ start: number, end: number }} Character positions of { and }.
 * @throws {Error}
 */
function _findEntryBounds(fileContent, idValue) {
  const arrayStart = fileContent.indexOf('[');
  if (arrayStart === -1) {
    throw new Error('replaceEntry: cannot find opening [ in file content.');
  }

  // Regex matches both "id": "sp-hcs-3" and id: "sp-hcs-3"
  const idPattern = new RegExp(
    '(?:"id"|\\bid\\b)\\s*:\\s*' + escapeRegex(JSON.stringify(idValue))
  );

  let i     = arrayStart + 1;
  let depth = 0; // depth relative to the inside of the array (0 = array top level)

  while (i < fileContent.length) {
    const ch = fileContent[i];

    // Skip string literals — advances i past the closing "
    if (ch === '"') {
      i++;
      while (i < fileContent.length) {
        if (fileContent[i] === '\\') { i += 2; continue; } // escaped char
        if (fileContent[i] === '"')  { i++;    break;     } // end of string
        i++;
      }
      continue;
    }

    if (ch === '{') {
      if (depth === 0) {
        // Opening brace of a top-level array entry — find its matching }
        const entryOpen  = i;
        const entryClose = _matchingClose(fileContent, i);
        const entryText  = fileContent.slice(entryOpen, entryClose + 1);

        if (idPattern.test(entryText)) {
          return { start: entryOpen, end: entryClose };
        }

        // Not the target entry — skip past it entirely
        i = entryClose + 1;
        continue;
      }
      // Should not reach here in well-formed files (inner braces are handled
      // inside _matchingClose), but guard depth anyway.
      depth++;
    } else if (ch === '}') {
      depth--;
    }

    i++;
  }

  throw new Error(
    `replaceEntry: entry with id "${idValue}" not found in file content.`
  );
}

/**
 * Returns the index of the } that closes the { at openPos.
 * Uses the same string-aware scanning as _findEntryBounds.
 *
 * @param {string} content
 * @param {number} openPos - Index of the opening {
 * @returns {number}       - Index of the matching }
 * @throws {Error}         - If no matching } is found (malformed file)
 */
function _matchingClose(content, openPos) {
  let depth = 0;
  let i     = openPos;

  while (i < content.length) {
    const ch = content[i];

    if (ch === '"') {
      i++;
      while (i < content.length) {
        if (content[i] === '\\') { i += 2; continue; }
        if (content[i] === '"')  { i++;    break;     }
        i++;
      }
      continue;
    }

    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return i;
    }

    i++;
  }

  throw new Error('replaceEntry: unmatched { in file content — file may be malformed.');
}
