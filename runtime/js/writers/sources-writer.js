/* ---------------------------------------------------------
   Path:         runtime/js/writers/sources-writer.js
   File:         sources-writer.js
   Version:      V1.2
   Data Schema:  pipeline/data/raw/sources.js (raw)
                 pipeline/data/config/source-books-map.json (map)
                 runtime/data/sources-dataset.js (runtime)
   System:       DnD-RSR — D&D 5e Dynamic Reference System
   Module/Role:  Writer — Sources triple-write (SRD raw → map JSON → runtime dataset)
   Dependencies: runtime/js/writers/write-orchestrator.js
   Created:      2026-05-02
   Last Updated: 2026-06-07
  Changelog:
    V1.2:
    - Fixed SERVER_BASE constant — was string literal 'window.location.origin';
      now correctly reads window.location.origin at runtime.
    - Fixed PATH_SRD — was 'pipeline/data/raw/sources.js' (already correct in V1.1).
    - Fixed PATH_MAP — was 'pipeline/data/config/source-books-map.json' (already correct in V1.1).
    - System name updated to DnD-RSR.
    V1.1:
    - Added _assertNoDuplicate() guard — throws before any write if the supplied ID key already exists in sources.js
    V1.0:
--------------------------------------------------------- */

/**
 * NOTE — extraPipelineWrites
 * This writer passes an `extraPipelineWrites` array to orchestrateWrite() so
 * that source-books-map.json is written after the primary pipeline file and
 * before the runtime dataset file, and is covered by the same abort-on-fail
 * logic. orchestrateWrite() must support the `extraPipelineWrites` option.
 *
 * NOTE — file reads
 * Current file contents are fetched via GET from the local Flask server
 * (server.py). This assumes the server serves all project files from
 * BASE_DIR, which is required for reads to work.
 */

import { orchestrateWrite } from './write-orchestrator.js';

// ── Constants ──────────────────────────────────────────────────────────────────

const SERVER_BASE  = window.location.origin;
const PATH_SRD     = 'pipeline/data/raw/sources.js';
const PATH_MAP     = 'pipeline/data/config/source-books-map.json';
const PATH_DATASET = 'runtime/data/sources-dataset.js';

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Add a new source entry as a triple-write in the prescribed order:
 *   1. pipeline/data/raw/sources.js          (pipeline raw)
 *   2. pipeline/data/config/source-books-map.json (pipeline config)
 *   3. runtime/data/sources-dataset.js               (runtime dataset)
 * Flag is written after all three succeed.
 * If the pipeline SRD write fails the sequence aborts — nothing is written.
 * If a subsequent write fails, pipeline data is safe and recoverable.
 *
 * @param {object} formValues — output of SourcesForm.getValues()
 *   { idKey, name, abbreviation, publisher, year, aliases? }
 * @throws {Error} on fetch failure or write failure
 */
export async function writeSource(formValues) {
  // 1. Fetch current file contents in parallel.
  const [srdContent, mapContent, datasetContent] = await Promise.all([
    _fetchFile(PATH_SRD),
    _fetchFile(PATH_MAP),
    _fetchFile(PATH_DATASET),
  ]);

  // 2. Guard against duplicate IDs.
  _assertNoDuplicate(srdContent, formValues.idKey);

  // 3. Build new records.
  const rawRecord     = _buildRawRecord(formValues);
  const runtimeRecord = _buildRuntimeRecord(formValues);

  // 4. Build new file contents.
  const newSrdContent     = _appendToSrdFile(srdContent, rawRecord);
  const newMapContent     = _appendToMapFile(mapContent, formValues.name, runtimeRecord.id);
  const newDatasetContent = _appendToDatasetFile(datasetContent, runtimeRecord);

  // 5. Triple-write via orchestrateWrite.
  //    extraPipelineWrites are applied after the primary pipeline file succeeds
  //    and before the runtime file is written.
  await orchestrateWrite({
    pipelinePath:    PATH_SRD,
    pipelineContent: newSrdContent,
    extraPipelineWrites: [
      { path: PATH_MAP, content: newMapContent },
    ],
    runtimePath:    PATH_DATASET,
    runtimeContent: newDatasetContent,
  });
}

// ── Record builders ────────────────────────────────────────────────────────────

/**
 * Build the pipeline raw record from form values.
 * id field is SRC_-prefixed and uppercased (e.g. "SRC_PHB14").
 * aliases is included only when present on formValues.
 * Field order matches the existing sources.js schema.
 * @param {object} formValues
 * @returns {object}
 */
function _buildRawRecord({ idKey, name, abbreviation, aliases, publisher, year }) {
  const record = {
    id:           `SRC_${idKey}`,
    name,
    abbreviation,
    publisher,
    year,
  };

  if (aliases && aliases.length > 0) {
    // Preserve schema field order: id, name, abbreviation, aliases, publisher, year
    return {
      id:           record.id,
      name:         record.name,
      abbreviation: record.abbreviation,
      aliases,
      publisher:    record.publisher,
      year:         record.year,
    };
  }

  return record;
}

/**
 * Build the runtime record from form values, applying the schema transform:
 *   id           — strip SRC_ prefix, lowercase (e.g. "phb14")
 *   abbreviation — renamed to short
 *   aliases      — dropped entirely
 * @param {object} formValues
 * @returns {{ id, name, short, publisher, year }}
 */
function _buildRuntimeRecord({ idKey, name, abbreviation, publisher, year }) {
  return {
    id:        idKey.toLowerCase(),
    name,
    short:     abbreviation,
    publisher,
    year,
  };
}

// ── File content builders ──────────────────────────────────────────────────────

/**
 * Append a raw record to the sources.js content string.
 * Strategy: locate the last `}` in the file (closing brace of the final record)
 * and insert `,\n<serialized record>` immediately after it.
 * @param {string} content — current file content
 * @param {object} rawRecord
 * @returns {string}
 */
function _appendToSrdFile(content, rawRecord) {
  const insertIdx = content.lastIndexOf('}');
  if (insertIdx === -1) {
    throw new Error('sources-writer: could not locate insertion point in sources.js');
  }
  const serialized = _serializeRawRecord(rawRecord);
  return (
    content.slice(0, insertIdx + 1) +
    ',\n' +
    serialized +
    content.slice(insertIdx + 1)
  );
}

/**
 * Append a name → runtimeId entry to the source-books-map.json content string.
 * Parses, adds the new key, and re-serializes as standard JSON (2-space indent).
 * Note: cosmetic column alignment in the existing file is not preserved.
 * @param {string} content   — current file content
 * @param {string} name      — source book name (map key)
 * @param {string} runtimeId — lowercase runtime id (map value)
 * @returns {string}
 */
function _appendToMapFile(content, name, runtimeId) {
  let map;
  try {
    map = JSON.parse(content);
  } catch (err) {
    throw new Error(
      `sources-writer: failed to parse source-books-map.json — ${err.message}`
    );
  }
  map[name] = runtimeId;
  return JSON.stringify(map, null, 2) + '\n';
}

/**
 * Append a runtime record to the sources-dataset.js content string.
 * Strategy: identical to _appendToSrdFile — locate last `}`, insert after it.
 * @param {string} content       — current file content
 * @param {object} runtimeRecord
 * @returns {string}
 */
function _appendToDatasetFile(content, runtimeRecord) {
  const insertIdx = content.lastIndexOf('}');
  if (insertIdx === -1) {
    throw new Error('sources-writer: could not locate insertion point in sources-dataset.js');
  }
  const serialized = _serializeRuntimeRecord(runtimeRecord);
  return (
    content.slice(0, insertIdx + 1) +
    ',\n' +
    serialized +
    content.slice(insertIdx + 1)
  );
}

// ── Serializers ────────────────────────────────────────────────────────────────

/**
 * Serialize a raw record to pipeline JS object literal format.
 * Keys are unquoted; aliases line is omitted when not present.
 * @param {object} rawRecord
 * @returns {string}
 */
function _serializeRawRecord({ id, name, abbreviation, aliases, publisher, year }) {
  const lines = [
    `  {`,
    `    id: "${id}",`,
    `    name: "${name}",`,
    `    abbreviation: "${abbreviation}",`,
  ];

  if (aliases && aliases.length > 0) {
    const aliasStr = aliases.map((a) => `"${a}"`).join(', ');
    lines.push(`    aliases: [${aliasStr}],`);
  }

  lines.push(`    publisher: "${publisher}",`);
  lines.push(`    year: ${year}`);
  lines.push(`  }`);

  return lines.join('\n');
}

/**
 * Serialize a runtime record to runtime dataset format (quoted keys).
 * @param {object} runtimeRecord
 * @returns {string}
 */
function _serializeRuntimeRecord({ id, name, short, publisher, year }) {
  return [
    `  {`,
    `    "id": "${id}",`,
    `    "name": "${name}",`,
    `    "short": "${short}",`,
    `    "publisher": "${publisher}",`,
    `    "year": ${year}`,
    `  }`,
  ].join('\n');
}

// ── Duplicate guard ────────────────────────────────────────────────────────────

/**
 * Throw if idKey already exists in the current sources.js content.
 * Matches against the full SRC_-prefixed id field to avoid false positives
 * on partial string matches.
 * @param {string} srdContent — current file content
 * @param {string} idKey      — bare key from form (e.g. "PHB14")
 */
function _assertNoDuplicate(srdContent, idKey) {
  const fullId  = `SRC_${idKey}`;
  const pattern = new RegExp(`id:\\s*["']${fullId}["']`);
  if (pattern.test(srdContent)) {
    throw new Error(
      `Duplicate ID — "${fullId}" already exists in sources.js. ` +
      `Choose a different ID key.`
    );
  }
}

// ── File fetch ─────────────────────────────────────────────────────────────────

/**
 * Fetch a project file's current content from the local Flask server.
 * @param {string} relativePath — path relative to project root
 * @returns {Promise<string>}
 */
async function _fetchFile(relativePath) {
  const url      = `${SERVER_BASE}/${relativePath}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `sources-writer: failed to fetch ${relativePath} (HTTP ${response.status})`
    );
  }
  return response.text();
}
