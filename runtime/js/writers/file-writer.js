/* ---------------------------------------------------------
   Path:         runtime/js/writers/file-writer.js
   File:         file-writer.js
   Version:      V1.1
   Data Schema:  N/A
   System:       DnD-RSR — D&D 5e Dynamic Reference System
                 D&D Reference System (personal site)
   Module/Role:  Writer — low-level file write via local server.
                 All domain writers route through this file.
                 Fixing the server URL here fixes all writes
                 across all domains.
   Dependencies: None
   Created:      2026-04-30
   Last Updated: 2026-05-24
   Changelog:
     V1.1: Replaced hardcoded localhost:5000 with
           window.location.origin. Works on any port, hostname,
           or device. Applies to all domain writers since they
           all call this function for file writes.
     V1.0: Initial creation.
--------------------------------------------------------- */

/**
 * POSTs a file write request to the local server.
 *
 * @param {string} path    - Relative path from project root
 *                           e.g. "runtime/data/spells-dataset.js"
 * @param {string} content - Full file content string to write
 * @returns {Promise<{ok: boolean, error?: string}>} Parsed JSON response
 * @throws {Error} On network failure or non-ok HTTP status
 */
export async function writeFile(path, content) {
  const response = await fetch(`${window.location.origin}/write-file`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, content }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`/write-file responded with HTTP ${response.status}: ${text}`);
  }

  return response.json();
}
