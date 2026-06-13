/* ---------------------------------------------------------
Path: pipeline/_core/normalization-engine.js
File: normalization-engine.js
Version: V1.1
Data Schema: V1.1
System: D&D Reference System – Data Pipeline V3.0
Module/Role: Core reusable normalization utilities for domain normalizers (normalize-spells, normalize-monsters, normalize-magic-items)
Dependencies:
  - pipeline/utils/provenance.js
  - pipeline/utils/logging.js
Created: 2026-03-10
Last Updated: 2026-03-11
Author: Bruce Pilcher
Changelog:
  V1.0: Initial implementation of reusable normalization engine for batch and single-record transformations
  V1.1: Added constants for new pipeline/data/ directories; auto-create directories if missing
Related Files:
  normalize-spells.js
  normalize-monsters.js
  normalize-magic-items.js
Notes:
  - Provides generic single-record and batch normalization functions
  - Supports domain-specific field-level transformations via optional transformer functions
  - Handles logging and provenance tracking consistently across all domains
  - Updated for new pipeline/data/ directory layout
--------------------------------------------------------- */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { trackProvenance } from '../utils/provenance.js';
import { logInfo, logWarning, logError } from '../utils/logging.js';
// Convert ES module URL to directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* =========================================================
   DATA DIRECTORIES (UPDATED)
   ========================================================= */
export const DATA_DIR = path.join(__dirname, "../data");
export const RAW_DIR = path.join(DATA_DIR, "raw");
export const NORMALIZED_DIR = path.join(DATA_DIR, "normalized");
export const AGGREGATED_DIR = path.join(DATA_DIR, "aggregated");
export const VERIFIED_DIR = path.join(DATA_DIR, "verified");

/* Ensure directories exist */
[RAW_DIR, NORMALIZED_DIR, AGGREGATED_DIR, VERIFIED_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

/* =========================================================
   CORE NORMALIZATION FUNCTIONS
   ========================================================= */

/**
 * Normalize a single record to canonical schema.
 * Optionally applies a domain-specific transformer function.
 *
 * @param {Object} rawRecord - Raw record object
 * @param {Function} transformerFn - Optional function to transform record fields
 * @returns {Object} Normalized record
 */
export function normalizeRecord(rawRecord, transformerFn) {
    const normalized = { ...rawRecord };
    return transformerFn ? transformerFn(normalized) : normalized;
}

/**
 * Normalize a batch of records with consistent logging and provenance tracking.
 *
 * @param {Array<Object>} rawRecords - Array of raw records
 * @param {String} datasetName - Name of the dataset (used for provenance)
 * @param {String} domain - Domain name (e.g., 'spells', 'monsters', 'magic-items')
 * @param {Function} singleRecordFn - Function to normalize a single record
 * @returns {Array<Object>} Array of normalized records
 */
export function normalizeBatch(rawRecords, datasetName, domain, singleRecordFn) {
    if (!Array.isArray(rawRecords)) {
        logError(`Expected an array of raw records for domain: ${domain}`);
        throw new Error(`normalizeBatch expects an array, received ${typeof rawRecords}`);
    }

    logInfo(`Normalizing ${rawRecords.length} ${domain} from dataset: ${datasetName}`);

    const normalizedRecords = rawRecords.map(record => {
        try {
            const normalized = singleRecordFn(record);
            trackProvenance(normalized, datasetName, domain);
            return normalized;
        } catch (err) {
            logWarning(`Normalization failed for ${domain} record with provisional ID '${record.id || '[no id]'}': ${err.message}`);
            throw err;
        }
    });

    logInfo(`Normalized ${normalizedRecords.length} ${domain} records from dataset: ${datasetName}`);

    return normalizedRecords;
}

/* =========================================================
   OPTIONAL HELPERS
   ========================================================= */

/**
 * Attach provenance to a record with logging.
 *
 * @param {Object} record - Normalized record
 * @param {String} datasetName - Name of the dataset
 * @param {String} domain - Domain name
 */
export function attachProvenance(record, datasetName, domain) {
    try {
        trackProvenance(record, datasetName, domain);
    } catch (err) {
        logWarning(`Failed to attach provenance for ${domain} record with provisional ID '${record.id || '[no id]'}': ${err.message}`);
    }
}