/* ---------------------------------------------------------
Path: pipeline/normalize/normalize-sources.js
File: normalize-sources.js
Version: V1.0
Data Schema: V1.1
System: D&D Reference System – Data Pipeline V3.0
Module/Role: Domain normalization for sources
Dependencies:
  - pipeline/_core/normalization-engine.js
  - pipeline/utils/logging.js
  - pipeline/data/config/source-books-map.json
Created: 2026-04-09
Last Updated: 2026-04-09
Author: Bruce Pilcher
Changelog:
  V1.0: Initial implementation, ported from norm/normalize-sources.js V7.2
Notes:
  - Sources is a foundational domain — all other domains depend on it
  - Canonical IDs are resolved via source-books-map.json, not taken
    raw from input. To add a new source book, add it to that file only.
  - Records with unrecognized or duplicate names are dropped with a warning
  - Five fields survive normalization: id, name, short, publisher, year
  - The raw field "abbreviation" is mapped to canonical field "short"
--------------------------------------------------------- */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { normalizeRecord, normalizeBatch, NORMALIZED_DIR } from '../_core/normalization-engine.js';
import { logWarning } from '../utils/logging.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

/* =========================================================
   CANONICAL SOURCE MAP
   Loaded from source-books-map.json at module init time.
   To add a new source book: edit source-books-map.json only.
   This file does not need to change.
   ========================================================= */

const SOURCE_MAP_PATH = path.resolve(__dirname, '../data/config/source-books-map.json');
const rawSourceMap    = JSON.parse(fs.readFileSync(SOURCE_MAP_PATH, 'utf-8'));

function normalizeKey(value) {
    return String(value)
        .toLowerCase()
        .replace(/['']/g, "'")
        .replace(/[^a-z0-9 ]/g, "")
        .trim();
}

// Pre-compute normalized keys for case/punctuation-tolerant lookup
const CANONICAL_SOURCE_MAP = Object.fromEntries(
    Object.entries(rawSourceMap).map(([name, id]) => [
        normalizeKey(name),
        id.toLowerCase()
    ])
);

/* =========================================================
   TRANSFORMER
   Returns a transformer function closed over a seenIds Set
   so duplicate detection is scoped to a single batch run.
   ========================================================= */

function makeTransformSourceFields(seenIds) {
    return function transformSourceFields(source) {
        const name      = typeof source.name         === 'string' ? source.name.trim()         : null;
        const short     = typeof source.abbreviation === 'string' ? source.abbreviation.trim() : null;
        const publisher = typeof source.publisher    === 'string' ? source.publisher.trim()    : null;
        const year      = typeof source.year         === 'number' ? source.year                : null;

        // All four raw fields are required
        if (!name || !short || !publisher || !year) {
            logWarning(
                `Source record missing required field(s) — dropping. ` +
                `name="${name}" short="${short}" publisher="${publisher}" year="${year}"`
            );
            throw new Error(`Source record missing required fields`);
        }

        // Resolve canonical ID from the source map
        const key = normalizeKey(name);
        const id  = CANONICAL_SOURCE_MAP[key];

        if (!id) {
            logWarning(
                `Unrecognized source name: "${name}" ` +
                `(normalized key: "${key}") — dropping record. ` +
                `To add this source, add it to source-books-map.json.`
            );
            throw new Error(`Unrecognized source: "${name}"`);
        }

        // Duplicate ID detection within this batch
        if (seenIds.has(id)) {
            logWarning(
                `Duplicate source ID detected: "${id}" for name "${name}" — dropping record`
            );
            throw new Error(`Duplicate source ID: "${id}"`);
        }

        seenIds.add(id);

        // Return only the five canonical fields.
        // "abbreviation" from raw data becomes "short" in the schema.
        return { id, name, short, publisher, year };
    };
}

/* =========================================================
   PUBLIC API
   ========================================================= */

/**
 * Normalize a single source record.
 * @param {Object} rawSource
 * @param {Set} seenIds - shared across the batch for duplicate detection
 * @returns {Object}
 */
function normalizeSource(rawSource, seenIds) {
    return normalizeRecord(rawSource, makeTransformSourceFields(seenIds));
}

/**
 * Normalize an array of source records and optionally save to
 * the normalized directory.
 * @param {Array<Object>} rawSources
 * @param {String} datasetName
 * @param {Boolean} saveToFile
 * @returns {Array<Object>}
 */
export function normalizeSources(rawSources, datasetName, saveToFile = false) {
    const seenIds = new Set();

    const normalized = normalizeBatch(
        rawSources,
        datasetName,
        'sources',
        (record) => normalizeSource(record, seenIds)
    );

    if (saveToFile) {
        const filename = `${datasetName}--sources.normalized.js`;
        const filepath = path.join(NORMALIZED_DIR, filename);
        const content  = `export default ${JSON.stringify(normalized, null, 2)};\n`;
        fs.writeFileSync(filepath, content, 'utf-8');
    }

    return normalized;
}