/* ---------------------------------------------------------
   Path:         runtime/js/writers/flag-writer.js
   File:         flag-writer.js
   Version:      V1.1
   Data Schema:  N/A
   System:       DnD-RSR — D&D 5e Dynamic Reference System
                 D&D Reference System (personal site)
   Module/Role:  Writer — pipeline-needed flag write via local
                 server. Called by write-orchestrator.js after
                 all file writes succeed. Non-fatal on failure.
   Dependencies: None
   Created:      2026-04-30
   Last Updated: 2026-05-24
   Changelog:
     V1.1: Replaced hardcoded localhost:5000 with
           window.location.origin. Updated JSDoc to reflect
           correct flag file location (project root, not
           pipeline/). server.py writes pipeline-needed.flag
           to project root with a UTC timestamp.
     V1.0: Initial creation.
--------------------------------------------------------- */

/**
 * POSTs a flag-write request to the local server.
 * The server creates pipeline-needed.flag at the project root
 * with a UTC timestamp. This signals that a pipeline run is
 * needed. The banner in pipeline-banner.js detects this file
 * on next page load.
 *
 * @returns {Promise<{ok: boolean, error?: string}>} Parsed JSON response
 * @throws {Error} On network failure or non-ok HTTP status
 */
export async function writeFlag() {
  const response = await fetch(`${window.location.origin}/write-flag`, {
    method: 'POST',
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`/write-flag responded with HTTP ${response.status}: ${text}`);
  }

  return response.json();
}
