/* ---------------------------------------------------------
   Path:         runtime/js/writers/spells-writer.js
   File:         spells-writer.js
   Version:      V1.6
   Data Schema:  spell record (pipeline raw + runtime dataset)
   System:       DnD-RSR — D&D 5e Dynamic Reference System
   Module/Role:  Writes spell records to pipeline and runtime dataset files (add and edit)
   Dependencies: write-orchestrator.js, data-paths.js, writer-utils.js
   Created:      2026-05-04
   Last Updated: 2026-06-07
--------------------------------------------------------- */
/* Changelog:
   V1.6:
   - Fixed SERVER constant — was string literal 'window.location.origin';
     now correctly reads window.location.origin at runtime.
   V1.5:
   - Updated "return newId;" to "return { id: newId };"
   V1.4:
   - updateSpell: pipeline-file-not-found changed from a blocking throw to
     a console.warn + runtime-only update. orchestrateWrite is called with
     skipPipelineWrite: true when the pipeline file is missing, so the runtime
     dataset and flag file are still written. Covers legacy SRD files whose
     names predate the source ID naming convention.
   V1.3:
   - Added updateSpell(data, existingId) — reads both pipeline and runtime
     files, re-serializes the record with the new form data, and uses
     replaceEntry() (imported from writer-utils.js V1.1) to overwrite the
     existing entry in place. Counter is not incremented on edit. Flag file
     is still written via orchestrateWrite.
   - _serializePipelineEntry and _serializeRuntimeEntry now accept an
     optional allSources parameter (array of { source, page } objects).
     When omitted the single-source behaviour used by writeSpell is
     preserved. updateSpell builds allSources from data.additionalSources
     (if any) and passes it down.
   - replaceEntry imported from writer-utils.js.
   V1.2:
   - Replaced inline counter-read block, pipeline-file-read block, runtime-file-read block, first-write scaffold, _appendEntry(), and _escapeRegex() with imports from writer-utils.js. Serializers unchanged.
   V1.1:
   - Replaced runtime-scan ID derivation with global counter file.
   - Counter file read on every write; bootstrapped from runtime datasets if missing. Counter update included in extraPipelineWrites.
   V1.0:
   - Initial creation. Implements writeSpell(formData).
   - Pipeline file is per-source; created from scratch on first write for a new source. Runtime file is always appended. Duplicate name check runs against the target pipeline file only.
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

const DOMAIN = 'spells';
const SERVER = window.location.origin;

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Writes a new spell record to the appropriate pipeline source file and to the
 * runtime dataset. Determines the target pipeline file from formData.source,
 * creating it if it does not yet exist.
 *
 * Write order (via orchestrateWrite):
 *   1. Pipeline source file  (e.g. pipeline/data/raw/spells-hcs.js)
 *   2. Counter file          (pipeline/data/id-counter.json)
 *   3. Runtime dataset       (runtime/data/spells-dataset.js)
 *   4. Pipeline flag         (handled by orchestrateWrite)
 *
 * If the counter file is missing it is bootstrapped from all sequenced
 * domain runtime files before the write proceeds.
 *
 * @param {Object} formData - As returned by getSpellsFormData().
 * @returns {Promise<string>} The new spell's ID, e.g. "sp-hcs-2026".
 * @throws {Error} On server error, malformed file content, or duplicate name.
 */
export async function writeSpell(formData) {
  const pipelinePath = getPipelinePath(DOMAIN, formData.source);
  const runtimePath  = getRuntimePath(DOMAIN);
  const counterPath  = getCounterPath();

  // ── 1. Read global ID counter ──────────────────────────────────────────────

  const currentHighest = await readCounter(SERVER);
  const newNum = currentHighest + 1;
  const newId  = `${getIdPrefix(DOMAIN)}-${formData.source}-${newNum}`;

  // ── 2. Read target pipeline file (may 404 for a brand-new source) ───────────

  const currentPipelineContent = await readPipelineFile(SERVER, pipelinePath);

  // ── 3. Read runtime dataset (needed to build updated runtime content) ────────

  const currentRuntimeContent = await readRuntimeFile(SERVER, runtimePath);

  // ── 4. Duplicate name check against the target pipeline file ─────────────────
  //
  // Checks only the source-specific pipeline file, not the full dataset.
  // This catches the most common case: re-adding a spell from the same source.

  if (currentPipelineContent !== null) {
    const namePattern = new RegExp(
      `name:\\s*${escapeRegex(JSON.stringify(formData.name))}`,
      'i',
    );
    if (namePattern.test(currentPipelineContent)) {
      throw new Error(
        `A spell named "${formData.name}" already exists in the ` +
        `${formData.source} pipeline file.`
      );
    }
  }

  // ── 5. Serialize ──────────────────────────────────────────────────────────────

  const pipelineEntry = _serializePipelineEntry(formData, newId);
  const runtimeEntry  = _serializeRuntimeEntry(formData, newId);

  // ── 6. Build full file contents ───────────────────────────────────────────────

  const newPipelineContent = currentPipelineContent === null
    ? buildNewPipelineFile(formData.source, DOMAIN, pipelineEntry)
    : appendEntry(currentPipelineContent, pipelineEntry);

  const newRuntimeContent = appendEntry(currentRuntimeContent, runtimeEntry);
  const newCounterContent = serializeCounter(newNum);

  // ── 7. Dual-write via orchestrator ────────────────────────────────────────────

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
 * Re-serializes an existing spell entry and overwrites it in both the
 * pipeline source file and the runtime dataset. The primary source ID
 * (encoded in existingId) cannot change. The counter is not incremented.
 * The flag file is still written via orchestrateWrite.
 *
 * Additional sources beyond the primary are taken from
 * data.additionalSources (array of { source, page }), which may be empty.
 *
 * @param {Object} data       - Form data from spells-form.js (edit mode).
 *                              data.source must match the primary source in existingId.
 *                              data.additionalSources (optional) — extra source records.
 * @param {string} existingId - The spell's existing id (e.g. "sp-hcs-3").
 * @returns {Promise<{id: string}>}
 * @throws {Error} On read failure or write failure.
 */
export async function updateSpell(data, existingId) {
  const pipelinePath = getPipelinePath(DOMAIN, data.source);
  const runtimePath  = getRuntimePath(DOMAIN);

  // Build the full sources array: primary first, then any additional sources.
  const allSources = [
    { source: data.source, page: data.page },
    ...(data.additionalSources ?? []),
  ];

  // ── Read pipeline file ─────────────────────────────────────────────────
  // A null result means the file does not exist under the expected name.
  // This happens with legacy SRD files named before the source ID convention
  // was established. We warn and proceed with a runtime-only update rather
  // than blocking the user entirely.

  const currentPipelineContent = await readPipelineFile(SERVER, pipelinePath);
  const pipelineMissing        = currentPipelineContent === null;
  if (pipelineMissing) {
    console.warn(
      `[spells-writer] Pipeline file for source "${data.source}" not found ` +
      `at ${pipelinePath}. Runtime dataset will be updated; pipeline file ` +
      `will not. Rename the pipeline file to match the source ID to resolve ` +
      `this permanently.`
    );
  }

  // ── Read runtime dataset ───────────────────────────────────────────────

  const currentRuntimeContent = await readRuntimeFile(SERVER, runtimePath);

  // ── Serialize and replace ──────────────────────────────────────────────
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

  // ── Dual-write (no counter update on edit) ─────────────────────────────

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
// Pipeline format: unquoted keys, description stored as `desc`.
// Runtime format:  quoted keys, name lowercased, description stored as `spell_desc`.

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
  const comps = data.components.map(c => JSON.stringify(c)).join(', ');

  const classLines = data.classes
    .map(c => `      ${JSON.stringify(c)},`)
    .join('\n');

  const descLines = data.desc
    .map(p => `      ${JSON.stringify(p)},`)
    .join('\n');

  // Each source gets its own indented block; multiple sources are comma-separated.
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
    `    level: ${data.level},`,
    `    school: ${JSON.stringify(data.school)},`,
    `    casting_time: ${JSON.stringify(data.casting_time)},`,
    `    range: ${JSON.stringify(data.range)},`,
    `    components: [${comps}],`,
    `    material: ${JSON.stringify(data.material)},`,
    `    duration: ${JSON.stringify(data.duration)},`,
    `    concentration: ${data.concentration},`,
    `    ritual: ${data.ritual},`,
    `    desc: [`,
    descLines,
    `    ],`,
    `    classes: [`,
    classLines,
    `    ],`,
    `    sources: [`,
    sourceBlocks,
    `    ],`,
    `    id: ${JSON.stringify(id)},`,
    `  },`,
  ];

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
    name:                 data.name.toLowerCase(),
    level:                data.level,
    school:               data.school,
    casting_time:         data.casting_time,
    range:                data.range,
    components:           data.components,
    material:             data.material,
    duration:             data.duration,
    concentration:        data.concentration,
    ritual:               data.ritual,
    classes:              data.classes,
    sources:              allSources.map(s => ({
                            source: s.source,
                            page:   s.page ?? 'N/A',
                          })),
    id,
    spell_desc:           data.desc,
    data_file_provenance: data.source,  // always the primary source
  };

  const json     = JSON.stringify(obj, null, 2);
  const indented = json.split('\n').map(line => '  ' + line).join('\n');
  return indented + ',';
}
