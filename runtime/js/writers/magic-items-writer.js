/* ---------------------------------------------------------
   Path:         runtime/js/writers/magic-items-writer.js
   File:         magic-items-writer.js
   Version:      V1.5
   Data Schema:  magic item record (pipeline raw + runtime dataset)
   System:       DnD-RSR — D&D 5e Dynamic Reference System
   Module/Role:  Writes magic item records to pipeline and runtime dataset files (add and edit)
   Dependencies: write-orchestrator.js, data-paths.js, writer-utils.js
   Created:      2026-05-04
   Last Updated: 2026-06-07
--------------------------------------------------------- */
/* Changelog:
   V1.5:
   - Fixed SERVER constant — was string literal 'window.location.origin';
     now correctly reads window.location.origin at runtime.
   V1.4:
   - Added updateMagicItem(data, existingId) — reads both pipeline and runtime files, re-serializes the record with the new form data, and uses replaceEntry() (imported from writer-utils.js V1.1) to overwrite the existing entry in place. Counter is not incremented on edit. Flag file is still written via orchestrateWrite.
   - Pipeline-file-not-found in updateMagicItem is treated as a non-blocking warning (console.warn) and proceeds with a runtime-only update via skipPipelineWrite: true. Covers legacy files whose names predate the source ID naming convention.
   - _serializePipelineEntry and _serializeRuntimeEntry now accept an optional allSources parameter (array of { source, page } objects). When omitted the single-source behaviour used by writeMagicItem is preserved. updateMagicItem builds allSources from data.additionalSources (if any) and passes it down.
   - replaceEntry imported from writer-utils.js.
   V1.3:
   - Updated "return newId;" to "return { id: newId };" to match the writer return contract (all writers return { id } on success).
   V1.2:
   - Replaced inline counter-read block, pipeline-file-read block, runtime-file-read block, first-write scaffold, _appendEntry(), and _escapeRegex() with imports from writer-utils.js. Serializers unchanged.
   V1.1:
   - Replaced runtime-scan ID derivation with global counter file.
   - Counter file read on every write; bootstrapped from runtime datasets if missing. Counter update included in extraPipelineWrites.
   V1.0:
   - Initial creation. Implements writeMagicItem(formData). Pipeline file is per-source; created from scratch on first write for a new source. Runtime file is always appended. Duplicate name check runs against the target pipeline file only. Pipeline format uses Title Case for category and rarity. Runtime format lowercases both.
*/

import { orchestrateWrite } from './write-orchestrator.js';
import {
  getPipelinePath,
  getRuntimePath,
  getIdPrefix,
  getCounterPath,
  serializeCounter,
} from './data-paths.js';
import {
  readCounter,
  readPipelineFile,
  readRuntimeFile,
  appendEntry,
  buildNewPipelineFile,
  escapeRegex,
  replaceEntry,
} from './writer-utils.js';

// ── Constants ──────────────────────────────────────────────────────────────

const DOMAIN = 'magic-items';
const SERVER = window.location.origin;

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Writes a new magic item record to the appropriate pipeline source file and
 * to the runtime dataset. Determines the target pipeline file from
 * formData.source, creating it if it does not yet exist.
 *
 * Write order (via orchestrateWrite):
 *   1. Pipeline source file  (e.g. pipeline/data/raw/magic-items-EoW.js)
 *   2. Counter file          (pipeline/data/id-counter.json)
 *   3. Runtime dataset       (runtime/data/magic-items-dataset.js)
 *   4. Pipeline flag         (handled by orchestrateWrite)
 *
 * If the counter file is missing it is bootstrapped from all sequenced
 * domain runtime files before the write proceeds.
 *
 * @param {Object} formData - As returned by getMagicItemsFormData().
 * @returns {Promise<{id: string}>} The new item's ID, e.g. "mi-EoW-2026".
 * @throws {Error} On server error, malformed file content, or duplicate name.
 */
export async function writeMagicItem(formData) {
  const pipelinePath = getPipelinePath(DOMAIN, formData.source);
  const runtimePath  = getRuntimePath(DOMAIN);
  const counterPath  = getCounterPath();

  // ── 1. Read global ID counter ─────────────────────────────────────────────

  const currentHighest = await readCounter(SERVER);
  const newNum = currentHighest + 1;
  const newId  = `${getIdPrefix(DOMAIN)}-${formData.source}-${newNum}`;

  // ── 2. Read target pipeline file (may 404 for a brand-new source) ──────────

  const currentPipelineContent = await readPipelineFile(SERVER, pipelinePath);

  // ── 3. Read runtime dataset ───────────────────────────────────────────────

  const currentRuntimeContent = await readRuntimeFile(SERVER, runtimePath);

  // ── 4. Duplicate name check against the target pipeline file ────────────────

  if (currentPipelineContent !== null) {
    const namePattern = new RegExp(
      `name:\\s*${escapeRegex(JSON.stringify(formData.name))}`,
      'i',
    );
    if (namePattern.test(currentPipelineContent)) {
      throw new Error(
        `A magic item named "${formData.name}" already exists in the ` +
        `${formData.source} pipeline file.`
      );
    }
  }

  // ── 5. Serialize ────────────────────────────────────────────────────────────

  const pipelineEntry = _serializePipelineEntry(formData, newId);
  const runtimeEntry  = _serializeRuntimeEntry(formData, newId);

  // ── 6. Build full file contents ─────────────────────────────────────────────

  const newPipelineContent = currentPipelineContent === null
    ? buildNewPipelineFile(formData.source, DOMAIN, pipelineEntry)
    : appendEntry(currentPipelineContent, pipelineEntry);

  const newRuntimeContent = appendEntry(currentRuntimeContent, runtimeEntry);
  const newCounterContent = serializeCounter(newNum);

  // ── 7. Dual-write via orchestrator ──────────────────────────────────────────

  await orchestrateWrite({
    pipelinePath,
    pipelineContent:     newPipelineContent,
    extraPipelineWrites: [{ path: counterPath, content: newCounterContent }],
    runtimePath,
    runtimeContent:      newRuntimeContent,
  });

  return { id: newId };
}

/**
 * Re-serializes an existing magic item entry and overwrites it in both the
 * pipeline source file and the runtime dataset. The primary source ID
 * (encoded in existingId) cannot change. The counter is not incremented.
 * The flag file is still written via orchestrateWrite.
 *
 * When the pipeline file is not found (legacy naming mismatch), a warning
 * is logged and the runtime dataset is updated without the pipeline file.
 *
 * Additional sources beyond the primary are taken from
 * data.additionalSources (array of { source, page }), which may be empty.
 *
 * @param {Object} data       - Form data from magic-items-form.js (edit mode).
 *                              data.source must match the primary source in existingId.
 *                              data.additionalSources (optional) — extra source records.
 * @param {string} existingId - The magic item's existing id (e.g. "mi-EoW-3").
 * @returns {Promise<{id: string}>}
 * @throws {Error} On read failure or write failure.
 */
export async function updateMagicItem(data, existingId) {
  const pipelinePath = getPipelinePath(DOMAIN, data.source);
  const runtimePath  = getRuntimePath(DOMAIN);

  // Build the full sources array: primary first, then any additional sources.
  const allSources = [
    { source: data.source, page: data.page },
    ...(data.additionalSources ?? []),
  ];

  // ── Read pipeline file ─────────────────────────────────────────────────────
  // A null result means the file does not exist under the expected name.
  // This happens with legacy files named before the source ID convention was
  // established. We warn and proceed with a runtime-only update rather than
  // blocking the user entirely.

  const currentPipelineContent = await readPipelineFile(SERVER, pipelinePath);
  const pipelineMissing        = currentPipelineContent === null;
  if (pipelineMissing) {
    console.warn(
      `[magic-items-writer] Pipeline file for source "${data.source}" not ` +
      `found at ${pipelinePath}. Runtime dataset will be updated; pipeline ` +
      `file will not. Rename the pipeline file to match the source ID to ` +
      `resolve this permanently.`
    );
  }

  // ── Read runtime dataset ───────────────────────────────────────────────────

  const currentRuntimeContent = await readRuntimeFile(SERVER, runtimePath);

  // ── Serialize and replace ──────────────────────────────────────────────────
  // Pipeline serialization and replace are skipped when the file is missing.

  const runtimeEntry      = _serializeRuntimeEntry(data, existingId, allSources);
  const newRuntimeContent = replaceEntry(currentRuntimeContent, existingId, runtimeEntry);

  const newPipelineContent = pipelineMissing
    ? undefined
    : replaceEntry(
        currentPipelineContent,
        existingId,
        _serializePipelineEntry(data, existingId, allSources),
      );

  // ── Dual-write (no counter update on edit) ─────────────────────────────────

  await orchestrateWrite({
    pipelinePath,
    pipelineContent:   newPipelineContent,
    runtimePath,
    runtimeContent:    newRuntimeContent,
    skipPipelineWrite: pipelineMissing,
  });

  return { id: existingId };
}

// ── Serializers ────────────────────────────────────────────────────────────────
//
// Pipeline format: unquoted keys, Title Case category/rarity, `desc` field.
// Runtime format:  quoted keys,   lowercase  category/rarity, `item_desc` field.

/**
 * @param {Object} data
 * @param {string} id
 * @param {Array}  [allSources] - Full sources array. Defaults to the single
 *                 primary source from data when omitted (add-mode behaviour).
 */
function _serializePipelineEntry(
  data,
  id,
  allSources = [{ source: data.source, page: data.page }],
) {
  const descLines = data.desc
    .map(p => `      ${JSON.stringify(p)},`)
    .join('\n');

  // Each source gets its own indented block.
  const sourceBlocks = allSources.map(s => {
    const pageValue = s.page === null || s.page === undefined
      ? 'null'
      : JSON.stringify(s.page);
    return [
      `      {`,
      `        source: ${JSON.stringify(s.source)},`,
      `        page: ${pageValue}`,
      `      }`,
    ].join('\n');
  }).join(',\n');

  const lines = [
    '  {',
    `    name: ${JSON.stringify(data.name)},`,
    `    magic_item_category: ${JSON.stringify(data.category)},`,
    `    item_type: null,`,
    `    rarity: ${JSON.stringify(data.rarity)},`,
  ];

  // attunement omitted entirely for non-attunement items (matches existing convention)
  if (data.attunement) {
    lines.push('    attunement: true,');
  }

  lines.push(
    `    desc: [`,
    descLines,
    `    ],`,
    `    sources: [`,
    sourceBlocks,
    `    ],`,
    `    id: ${JSON.stringify(id)},`,
    `  },`,
  );

  return lines.join('\n');
}

/**
 * @param {Object} data
 * @param {string} id
 * @param {Array}  [allSources] - Full sources array. Defaults to the single
 *                 primary source from data when omitted (add-mode behaviour).
 */
function _serializeRuntimeEntry(
  data,
  id,
  allSources = [{ source: data.source, page: data.page }],
) {
  const obj = {
    name:                    data.name.toLowerCase(),
    magic_item_category:     data.category.toLowerCase(),
    rarity:                  data.rarity.toLowerCase(),
    attunement:              data.attunement,
    attunement_restrictions: [],
    id,
    sources:                 allSources.map(s => ({
                               source: s.source,
                               page:   s.page ?? 'N/A',
                             })),
    data_file_provenance:    data.source,
    item_desc:               data.desc,
    properties:              [],
    bonus:                   '',
  };

  const json     = JSON.stringify(obj, null, 2);
  const indented = json.split('\n').map(line => '  ' + line).join('\n');
  return indented + ',';
}
