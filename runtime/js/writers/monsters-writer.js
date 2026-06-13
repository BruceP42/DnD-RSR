/* ---------------------------------------------------------
   Path:         runtime/js/writers/monsters-writer.js
   File:         monsters-writer.js
   Version:      V1.5
   Data Schema:  Monster schema v1.1
   System:       DnD-RSR — D&D 5e Dynamic Reference System
   Module/Role:  Writer — serializes and dual-writes monster entries (add and edit)
   Dependencies: write-orchestrator.js, data-paths.js, writer-utils.js
   Created:      2026-05-07
   Last Updated: 2026-06-07
--------------------------------------------------------- */
/* Changelog:
   V1.5:
   - Fixed SERVER constant — was string literal 'window.location.origin';
     now correctly reads window.location.origin at runtime.
   V1.4:
   - updateMonster: pipeline-file-not-found changed from a blocking throw to
     a console.warn + runtime-only update. orchestrateWrite is called with
     skipPipelineWrite: true when the pipeline file is missing, so the runtime
     dataset and flag file are still written. Covers legacy SRD files whose
     names predate the source ID naming convention.
   V1.3:
   - Added updateMonster(data, existingId) — reads both pipeline and runtime
     files, re-serializes the record with the new form data, and uses
     replaceEntry() (imported from writer-utils.js V1.1) to overwrite the
     existing entry in place. Counter is not incremented on edit. Flag file
     is still written via orchestrateWrite.
   - serializePipelineEntry and serializeRuntimeEntry now accept an optional
     allSources parameter (array of { source, page } objects). When omitted
     the single-source behaviour used by writeMonster is preserved.
     updateMonster builds allSources from data.additionalSources (if any)
     and passes it down.
   - replaceEntry imported from writer-utils.js.
   V1.2:
   - Replaced inline counter-read block, pipeline-file-read, and runtime-file-read with readCounter, readPipelineFile, and readRuntimeFile from writer-utils.js. Replaced buildPipelineContent and buildRuntimeContent helpers with buildNewPipelineFile and appendEntry from writer-utils.js (functionally equivalent after V1.1 fix; this is clean-up). Serializers unchanged.
   V1.1:
   - Fixed missing comma between entries in buildPipelineContent and buildRuntimeContent. Both functions now append ',\n' before the new entry rather than '\n', and apply a second trimEnd() after stripping the closing ']; ' to ensure the comma lands cleanly against the previous entry's closing brace.
   V1.0:
   - Initial creation. Reads the global ID counter (bootstraps via bootstrapHighest if missing), assigns the next ID, checks for duplicate names, serializes the pipeline entry (unquoted keys, flat ability scores) and runtime entry (quoted keys, nested ability_scores, runtime-only fields), then calls orchestrateWrite with the counter update as an extraPipelineWrite.
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
  replaceEntry,
} from './writer-utils.js';

const SERVER = window.location.origin;
const DOMAIN = 'monsters';

// Standard 5e CR → XP table (used when xp is not manually entered)
const CR_TO_XP = {
  0: 10, 0.125: 25, 0.25: 50, 0.5: 100,
  1: 200, 2: 450, 3: 700, 4: 1100, 5: 1800,
  6: 2300, 7: 2900, 8: 3900, 9: 5000, 10: 5900,
  11: 7200, 12: 8400, 13: 10000, 14: 11500, 15: 13000,
  16: 15000, 17: 18000, 18: 21000, 19: 25000, 20: 25000,
  21: 33000, 22: 41000, 23: 50000, 24: 62000, 30: 155000,
};

const ACTION_KEYS = [
  'traits', 'actions', 'bonus_actions', 'reactions',
  'legendary_actions', 'lair_actions', 'regional_effects',
];

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Serializes and dual-writes a new monster entry.
 *
 * Steps:
 *   1. Read (or bootstrap) the global ID counter
 *   2. Read the existing pipeline file for the given source (may be new)
 *   3. Read the existing runtime file
 *   4. Check for duplicate name in runtime
 *   5. Serialize pipeline entry and runtime entry
 *   6. Call orchestrateWrite — pipeline file + counter update first,
 *      runtime file second, flag last
 *
 * @param {object} data - Form data collected by monsters-form.js
 * @returns {Promise<{id: string}>} - The assigned monster ID on success
 * @throws {Error} On duplicate name, read failure, or write failure
 */
export async function writeMonster(data) {
  const { sourceId } = data;

  // ── Step 1: Read or bootstrap the ID counter ──────────────────────────
  const counterPath = getCounterPath();
  const highest     = await readCounter(SERVER);
  const newHighest  = highest + 1;
  const id          = `${getIdPrefix(DOMAIN)}-${sourceId}-${newHighest}`;

  // ── Step 2: Read existing pipeline file (may not exist yet) ──────────
  const pipelinePath     = getPipelinePath(DOMAIN, sourceId);
  const existingPipeline = await readPipelineFile(SERVER, pipelinePath);

  // ── Step 3: Read existing runtime file ────────────────────────────────
  const runtimePath     = getRuntimePath(DOMAIN);
  const existingRuntime = await readRuntimeFile(SERVER, runtimePath);

  // ── Step 4: Duplicate name check ──────────────────────────────────────
  const nameLower = data.name.toLowerCase();
  if (existingRuntime.includes(`"name": "${nameLower}"`)) {
    throw new Error(`A monster named "${data.name}" already exists in the runtime dataset.`);
  }

  // ── Step 5: Serialize ─────────────────────────────────────────────────
  const pEntry = serializePipelineEntry(data, id);
  const rEntry = serializeRuntimeEntry(data, id, sourceId);

  const pipelineContent = existingPipeline === null
    ? buildNewPipelineFile(sourceId, DOMAIN, pEntry)
    : appendEntry(existingPipeline, pEntry);

  const runtimeContent = appendEntry(existingRuntime, rEntry);
  const counterContent = serializeCounter(newHighest);

  // ── Step 6: Dual-write ────────────────────────────────────────────────
  await orchestrateWrite({
    pipelinePath,
    pipelineContent,
    extraPipelineWrites: [
      { path: counterPath, content: counterContent },
    ],
    runtimePath,
    runtimeContent,
  });

  return { id };
}

/**
 * Re-serializes an existing monster entry and overwrites it in both the
 * pipeline source file and the runtime dataset. The primary source ID
 * (encoded in existingId) cannot change. The counter is not incremented.
 * The flag file is still written via orchestrateWrite.
 *
 * Additional sources beyond the primary are taken from
 * data.additionalSources (array of { source, page }), which may be empty.
 *
 * @param {object} data       - Form data from monsters-form.js (edit mode).
 *                              data.sourceId must match the primary source in existingId.
 *                              data.additionalSources (optional) — extra source records.
 * @param {string} existingId - The monster's existing id (e.g. "mn-hcs-3").
 * @returns {Promise<{id: string}>}
 * @throws {Error} On read failure or write failure.
 */
export async function updateMonster(data, existingId) {
  const { sourceId } = data;

  // Build the full sources array: primary first, then any additional sources.
  const allSources = [
    { source: sourceId, page: data.page ?? 0 },
    ...(data.additionalSources ?? []).map(s => ({
      source: s.source,
      page:   s.page ?? 0,
    })),
  ];

  // ── Read pipeline file for the primary source ──────────────────────────
  // A null result means the file does not exist under the expected name.
  // This happens with legacy SRD files named before the source ID convention
  // was established. We warn and proceed with a runtime-only update rather
  // than blocking the user entirely.
  const pipelinePath     = getPipelinePath(DOMAIN, sourceId);
  const existingPipeline = await readPipelineFile(SERVER, pipelinePath);
  const pipelineMissing  = existingPipeline === null;
  if (pipelineMissing) {
    console.warn(
      `[monsters-writer] Pipeline file for source "${sourceId}" not found ` +
      `at ${pipelinePath}. Runtime dataset will be updated; pipeline file ` +
      `will not. Rename the pipeline file to match the source ID to resolve ` +
      `this permanently.`
    );
  }

  // ── Read runtime file ──────────────────────────────────────────────────
  const runtimePath     = getRuntimePath(DOMAIN);
  const existingRuntime = await readRuntimeFile(SERVER, runtimePath);

  // ── Serialize and replace ──────────────────────────────────────────────
  const rEntry         = serializeRuntimeEntry(data, existingId, sourceId, allSources);
  const runtimeContent = replaceEntry(existingRuntime, existingId, rEntry);

  // Pipeline serialization and replace are skipped when the file is missing.
  const pipelineContent = pipelineMissing
    ? undefined
    : replaceEntry(
        existingPipeline,
        existingId,
        serializePipelineEntry(data, existingId, allSources),
      );

  // ── Dual-write (no counter update on edit) ─────────────────────────────
  await orchestrateWrite({
    pipelinePath,
    pipelineContent,
    runtimePath,
    runtimeContent,
    skipPipelineWrite: pipelineMissing,
  });

  return { id: existingId };
}

// ── Pipeline serialization ─────────────────────────────────────────────────

/**
 * Serializes a monster data object as a pipeline raw entry.
 * Uses unquoted object keys. Ability scores are flat fields on the entry
 * (not nested) — this is the established pipeline convention.
 *
 * @param {object}   data
 * @param {string}   id
 * @param {Array}    [allSources] - Full sources array. Defaults to the single
 *                   primary source from data when omitted (add-mode behaviour).
 */
function serializePipelineEntry(
  data,
  id,
  allSources = [{ source: data.sourceId, page: data.page ?? 0 }],
) {
  const q = JSON.stringify;

  const sourcesStr = allSources
    .map(s => `{ source: ${q(s.source)}, page: ${s.page ?? 0} }`)
    .join(', ');

  return [
    `  {`,
    `    name: ${q(data.name)},`,
    `    size: ${q(data.size)},`,
    `    creature_type: ${q(data.creature_type)},`,
    `    subtype: ${q(data.subtype)},`,
    `    alignment: ${q(data.alignment)},`,
    `    ac: ${data.ac},`,
    `    armor_type: ${q(data.armor_type)},`,
    `    hp: ${data.hp},`,
    `    hit_dice: ${q(data.hit_dice)},`,
    `    speed: ${rawObj(data.speed)},`,
    `    str: ${data.str},`,
    `    dex: ${data.dex},`,
    `    con: ${data.con},`,
    `    int: ${data.int},`,
    `    wis: ${data.wis},`,
    `    cha: ${data.cha},`,
    `    saving_throws: ${rawObj(data.saving_throws)},`,
    `    skills: ${rawObj(data.skills)},`,
    `    damage_vulnerabilities: ${rawArr(data.damage_vulnerabilities)},`,
    `    damage_resistances: ${rawArr(data.damage_resistances)},`,
    `    damage_immunities: ${rawArr(data.damage_immunities)},`,
    `    condition_immunities: ${rawArr(data.condition_immunities)},`,
    `    senses: ${rawObj(data.senses)},`,
    `    languages: ${rawArr(data.languages)},`,
    `    cr: ${data.cr},`,
    ...ACTION_KEYS.map(key => `    ${key}: ${rawActionArr(data[key])},`),
    `    sources: [${sourcesStr}],`,
    `    id: ${q(id)},`,
    `  },`,
  ].join('\n');
}

/**
 * Serializes a plain object with unquoted keys (pipeline raw format).
 * Values may be strings, numbers, or booleans.
 */
function rawObj(obj) {
  if (!obj || Object.keys(obj).length === 0) return '{}';
  const entries = Object.entries(obj).map(([k, v]) => {
    if (typeof v === 'string')  return `${k}: ${JSON.stringify(v)}`;
    if (typeof v === 'boolean') return `${k}: ${v}`;
    return `${k}: ${v}`; // number
  });
  return `{ ${entries.join(', ')} }`;
}

/**
 * Serializes an array of strings in pipeline raw format.
 */
function rawArr(arr) {
  if (!arr || arr.length === 0) return '[]';
  return `[${arr.map(v => JSON.stringify(v)).join(', ')}]`;
}

/**
 * Serializes an action block array ({ name, desc } pairs) in pipeline raw
 * format. Each entry on its own indented line for readability.
 */
function rawActionArr(arr) {
  if (!arr || arr.length === 0) return '[]';
  const rows = arr.map(({ name, desc }) =>
    `      { name: ${JSON.stringify(name)}, desc: ${JSON.stringify(desc)} }`
  );
  return `[\n${rows.join(',\n')}\n    ]`;
}

// ── Runtime serialization ──────────────────────────────────────────────────

/**
 * Serializes a monster data object as a runtime dataset entry.
 * Uses quoted object keys and JSON-compatible types. Ability scores are
 * nested under ability_scores. Includes all runtime-only fields.
 *
 * @param {object}   data
 * @param {string}   id
 * @param {string}   sourceId    - Primary source ID (for data_file_provenance).
 * @param {Array}    [allSources] - Full sources array. Defaults to the single
 *                   primary source from data when omitted (add-mode behaviour).
 */
function serializeRuntimeEntry(
  data,
  id,
  sourceId,
  allSources = [{ source: sourceId, page: data.page ?? 0 }],
) {
  const xpGiven = data.xp !== null && data.xp !== undefined;
  const xp      = xpGiven ? data.xp : (CR_TO_XP[data.cr] ?? 0);

  const obj = {
    name:           data.name.toLowerCase(),
    size:           data.size,
    creature_type:  data.creature_type,
    subtype:        data.subtype,
    alignment:      data.alignment,
    ac:             data.ac,
    armor_type:     data.armor_type,
    hp:             data.hp,
    hit_dice:       data.hit_dice,
    speed:          data.speed,
    ability_scores: {
      str: data.str,
      dex: data.dex,
      con: data.con,
      int: data.int,
      wis: data.wis,
      cha: data.cha,
    },
    saving_throws:          data.saving_throws,
    skills:                 data.skills,
    damage_vulnerabilities: data.damage_vulnerabilities,
    damage_resistances:     data.damage_resistances,
    damage_immunities:      data.damage_immunities,
    condition_immunities:   data.condition_immunities,
    senses:                 data.senses,
    languages:              data.languages,
    cr:                     data.cr,
    traits:                 data.traits,
    actions:                data.actions,
    bonus_actions:          data.bonus_actions,
    reactions:              data.reactions,
    legendary_actions:      data.legendary_actions,
    lair_actions:           data.lair_actions,
    regional_effects:       data.regional_effects,
    sources:                allSources.map(s => ({ source: s.source, page: s.page ?? 0 })),
    id,
    data_file_provenance:   sourceId,
    xp,
    xp_given:               xpGiven,
    cr_given:               true,
    cr_xp_mismatch:         false,
  };

  // Indent 2 spaces so the entry sits correctly inside the export default array
  return '  ' + JSON.stringify(obj, null, 2).split('\n').join('\n  ');
}
