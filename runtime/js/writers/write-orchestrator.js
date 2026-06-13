/* ---------------------------------------------------------
   Path:         runtime/js/writers/write-orchestrator.js
   File:         write-orchestrator.js
   Version:      V1.2
   Data Schema:  N/A
   System:       D&D Reference System – RSR V1.0
   Module/Role:  Writer — coordinates dual-write sequence and flag write for all domains
   Dependencies: file-writer.js, flag-writer.js
   Created:      2026-04-30
   Last Updated: 2026-05-10
--------------------------------------------------------- */
/* Changelog:
   V1.2:
   - Added optional skipPipelineWrite parameter (default false). When true,
     step 1 (pipeline file write) and step 1b (extra pipeline writes) are
     skipped entirely. The runtime file and flag file are still written.
     Used by update writers when the pipeline source file does not exist
     (legacy naming mismatch) so that the runtime can still be updated
     without throwing a blocking error.
   V1.1:
   - Added optional `extraPipelineWrites` parameter — array of { path, content }
     entries written after the primary pipeline file and before the runtime file,
     with abort-on-fail semantics; supports the sources triple-write.
   V1.0:
   - Initial creation.
Notes:
  - All domain form writers call this; they do not call file-writer or flag-writer directly
  - Default write order: pipeline file → extra pipeline files → runtime file → flag
  - Flag write failure is non-fatal (logged as warning, does not throw)
  - When skipPipelineWrite is true: runtime file → flag only
--------------------------------------------------------- */

import { writeFile } from './file-writer.js';
import { writeFlag } from './flag-writer.js';

/**
 * Coordinates the dual-write sequence for any domain add/edit operation.
 * Domain form writers call this; they do not call file-writer or flag-writer directly.
 *
 * Default write order:
 *   1. Pipeline file  — source of truth; abort on failure
 *   1b. Extra pipeline writes — abort on failure
 *   2. Runtime file   — abort with recovery message on failure
 *   3. Flag file      — signals pipeline run needed; non-fatal on failure
 *
 * When skipPipelineWrite is true:
 *   2. Runtime file   — abort on failure
 *   3. Flag file      — non-fatal on failure
 *
 * @param {object}  params
 * @param {string}  params.pipelinePath         - Relative path for the pipeline raw file.
 * @param {string}  params.pipelineContent      - Content to write to the pipeline raw file.
 * @param {string}  params.runtimePath          - Relative path for the runtime dataset file.
 * @param {string}  params.runtimeContent       - Content to write to the runtime dataset file.
 * @param {Array}   [params.extraPipelineWrites] - Optional additional pipeline writes applied
 *                                                 after the primary pipeline file and before
 *                                                 the runtime file. Each entry: { path, content }.
 *                                                 Abort-on-fail semantics apply to each.
 *                                                 Ignored when skipPipelineWrite is true.
 * @param {boolean} [params.skipPipelineWrite=false] - When true, skips the pipeline file write
 *                                                 and all extraPipelineWrites. Only the runtime
 *                                                 file and flag are written. Used when the
 *                                                 pipeline source file cannot be located (e.g.
 *                                                 legacy SRD filename mismatch).
 * @returns {Promise<{ok: boolean}>} Success result object.
 * @throws {Error} On any write failure — message indicates which step failed.
 */
export async function orchestrateWrite({
  pipelinePath,
  pipelineContent,
  extraPipelineWrites = [],
  runtimePath,
  runtimeContent,
  skipPipelineWrite = false,
}) {
  // Steps 1 and 1b — Pipeline file(s)
  // Skipped entirely when skipPipelineWrite is true (e.g. legacy file naming).
  if (!skipPipelineWrite) {

    // Step 1 — Primary pipeline file (source of truth)
    let pipelineResult;
    try {
      pipelineResult = await writeFile(pipelinePath, pipelineContent);
    } catch (err) {
      throw new Error(`Pipeline write failed — nothing was written. (${err.message})`);
    }

    if (!pipelineResult.ok) {
      throw new Error(
        `Pipeline write rejected by server — nothing was written. ` +
        `(${pipelineResult.error ?? 'unknown error'})`
      );
    }

    // Step 1b — Extra pipeline writes (e.g. counter file for id-counter.json)
    for (const extra of extraPipelineWrites) {
      let extraResult;
      try {
        extraResult = await writeFile(extra.path, extra.content);
      } catch (err) {
        throw new Error(
          `Pipeline write failed for ${extra.path} — runtime was not written. ` +
          `Primary pipeline file was already written. (${err.message})`
        );
      }
      if (!extraResult.ok) {
        throw new Error(
          `Pipeline write rejected by server for ${extra.path} — runtime was not written. ` +
          `Primary pipeline file was already written. (${extraResult.error ?? 'unknown error'})`
        );
      }
    }

  } // end if (!skipPipelineWrite)

  // Step 2 — Runtime file
  let runtimeResult;
  try {
    runtimeResult = await writeFile(runtimePath, runtimeContent);
  } catch (err) {
    const pipelineNote = skipPipelineWrite
      ? 'Pipeline file was not written (skipPipelineWrite).'
      : 'Pipeline file was written but runtime was not.';
    throw new Error(
      `Runtime write failed — ${pipelineNote} ` +
      `Data is safe; it will be recovered on the next pipeline run. (${err.message})`
    );
  }

  if (!runtimeResult.ok) {
    const pipelineNote = skipPipelineWrite
      ? 'Pipeline file was not written (skipPipelineWrite).'
      : 'Pipeline file was written but runtime was not.';
    throw new Error(
      `Runtime write rejected by server — ${pipelineNote} ` +
      `Data is safe; it will be recovered on the next pipeline run. ` +
      `(${runtimeResult.error ?? 'unknown error'})`
    );
  }

  // Step 3 — Flag file (non-blocking: log warning but do not throw)
  try {
    const flagResult = await writeFlag();
    if (!flagResult.ok) {
      console.warn(
        `[write-orchestrator] Flag write rejected by server: ${flagResult.error ?? 'unknown error'}`
      );
    }
  } catch (err) {
    console.warn(`[write-orchestrator] Flag write failed (non-fatal): ${err.message}`);
  }

  return { ok: true };
}
