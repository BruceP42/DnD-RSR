/* ---------------------------------------------------------
   Path:         runtime/js/writers/data-paths.js
   File:         data-paths.js
   Version:      V1.3
   Data Schema:  n/a
   System:       DnD-RSR — D&D 5e Dynamic Reference System
   Module/Role:  Shared path-derivation and ID utilities for
                 all domain writers.
   Dependencies: none
   Created:      2026-05-04
   Last Updated: 2026-05-24
   Author:       Bruce Pilcher
   Changelog:
     V1.3: Adapted for DnD-RSR public repository.
           pipeline/ renamed to pipeline/ throughout.
           JSDoc serverUrl example updated from localhost:5000
           to localhost:8000 — single-server architecture,
           no separate Flask server.
           System name and header path updated.
     V1.2: Corrected monsters idPrefix from 'mon' to 'mo' to
           match canonical schema v1.1 domain prefix registry
           and existing dataset IDs (e.g. mo-SRD-1363).
     V1.1: Added getCounterPath, parseCounter, serializeCounter,
           bootstrapHighest. Writers use the counter file as the
           authoritative global ID sequence. bootstrapHighest
           scans all sequenced domain runtime files when the
           counter file is missing.
     V1.0: Initial creation. Provides getPipelinePath,
           getRuntimePath, getIdPrefix, and getMaxIdNumber.
--------------------------------------------------------- */

// ── Domain registry ────────────────────────────────────────────────────────
//
// To register a new domain, add one entry here. The idPrefix must be short,
// lowercase, and unique across all domains. Writers derive file paths and ID
// prefixes from this table rather than hardcoding them.
//
// Set countered: true for domains that participate in the global ID counter.
// Sources are excluded — their IDs use a different scheme with no number.

const DOMAIN_META = {
  spells:        { idPrefix: 'sp',  countered: true  },
  'magic-items': { idPrefix: 'mi',  countered: true  },
  monsters:      { idPrefix: 'mo',  countered: true  },
  sources:       { idPrefix: 'src', countered: false },
};

// All domains that share the global ID counter
const SEQUENCED_DOMAINS = Object.entries(DOMAIN_META)
  .filter(([, meta]) => meta.countered)
  .map(([domain]) => domain);

// ── Counter file ───────────────────────────────────────────────────────────

const COUNTER_PATH = 'pipeline/data/id-counter.json';

/**
 * Returns the path to the global ID counter file.
 */
export function getCounterPath() {
  return COUNTER_PATH;
}

/**
 * Parses the counter file content and returns the current highest ID number.
 *
 * @param {string} counterContent - Full text of id-counter.json.
 * @returns {number}
 */
export function parseCounter(counterContent) {
  return JSON.parse(counterContent).highest;
}

/**
 * Serializes a new highest number into the counter file format.
 *
 * @param {number} highest - The new highest ID number after this write.
 * @returns {string}
 */
export function serializeCounter(highest) {
  return JSON.stringify({ highest }, null, 2) + '\n';
}

/**
 * Bootstrap fallback: fetches all sequenced domain runtime files from the
 * server and returns the highest ID number found across all of them.
 * Called only when the counter file is missing (first run or accidental
 * deletion). Initializes the counter from live dataset state.
 *
 * Returns 999 when no entries exist yet — the first real entry gets 1000.
 *
 * @param {string} serverUrl - Base URL of the server,
 *                             e.g. 'http://localhost:8000'.
 * @returns {Promise<number>}
 */
export async function bootstrapHighest(serverUrl) {
  let max = 999;
  for (const domain of SEQUENCED_DOMAINS) {
    const path = getRuntimePath(domain);
    let res;
    try {
      res = await fetch(`${serverUrl}/${path}`);
    } catch {
      continue; // network error — skip this domain
    }
    if (!res.ok) continue; // domain runtime file may not exist yet
    const content = await res.text();
    const domainMax = getMaxIdNumber(domain, content);
    if (domainMax > max) max = domainMax;
  }
  return max;
}

// ── Path helpers ───────────────────────────────────────────────────────────

/**
 * Returns the pipeline raw file path for a given domain and source ID.
 *
 * Convention: one file per (domain, source) pair.
 * "homebrew" is a valid sourceId and receives its own file.
 *
 * @example
 *   getPipelinePath('spells', 'hcs')
 *   // => 'pipeline/data/raw/spells-hcs.js'
 *
 *   getPipelinePath('monsters', 'homebrew')
 *   // => 'pipeline/data/raw/monsters-homebrew.js'
 */
export function getPipelinePath(domain, sourceId) {
  return `pipeline/data/raw/${domain}-${sourceId}.js`;
}

/**
 * Returns the runtime dataset file path for a given domain.
 * This file is the merged output consumed by the RSR at runtime.
 *
 * @example
 *   getRuntimePath('monsters')
 *   // => 'runtime/data/monsters-dataset.js'
 */
export function getRuntimePath(domain) {
  return `runtime/data/${domain}-dataset.js`;
}

/**
 * Returns the short ID prefix for a given domain.
 * Falls back to the first three characters of the domain name for
 * unregistered domains, so new domains work before being added to
 * DOMAIN_META (though registering them is preferred).
 *
 * @example
 *   getIdPrefix('spells')    // => 'sp'
 *   getIdPrefix('monsters')  // => 'mo'
 */
export function getIdPrefix(domain) {
  return DOMAIN_META[domain]?.idPrefix ?? domain.slice(0, 3);
}

/**
 * Scans the full text of a runtime dataset file and returns the highest
 * numeric suffix found across all IDs for the given domain.
 *
 * Used internally by bootstrapHighest. Writers should use the counter file
 * for ID generation, not this function directly.
 *
 * ID format expected: "{prefix}-{sourceId}-{number}"
 * Source IDs containing hyphens are not supported.
 *
 * Returns 999 as a floor when no IDs are found.
 *
 * @param {string} domain         - Domain key, e.g. 'monsters'
 * @param {string} runtimeContent - Full text of the runtime dataset file
 * @returns {number}
 */
export function getMaxIdNumber(domain, runtimeContent) {
  const prefix = getIdPrefix(domain);
  const re = new RegExp(`"${prefix}-[^-"]+-([0-9]+)"`, 'g');
  let max = 999;
  let match;
  while ((match = re.exec(runtimeContent)) !== null) {
    const n = parseInt(match[1], 10);
    if (n > max) max = n;
  }
  return max;
}
