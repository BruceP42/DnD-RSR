/* ---------------------------------------------------------
Path: pipeline/_core/aggregation-engine.js
File: aggregation-engine.js
Version: V1.3
Data Schema: V1.1
System: D&D Reference System – Data Pipeline V3.0
Module/Role: Core reusable aggregation utilities for domain aggregators
Dependencies:
  - pipeline/utils/provenance.js
  - pipeline/utils/logging.js
Created: 2026-03-10
Last Updated: 2026-03-11
Author: Bruce Pilcher
Changelog:
  V1.0: Initial reusable aggregation engine implementation
  V1.1: Added hardcoded dataset precedence with unmapped datasets rule; deterministic ordering by canonicalized fields
  V1.2: Added deterministic sort logging and aggregation summary logging for improved observability
  V1.3: Added advanced duplicate-name detection logging across datasets
Notes:
  - Domain aggregators should remain thin wrappers around these reusable functions.
  - Supports multiple normalized datasets per domain.
  - Applies deterministic ordering and provenance tracking.
  - Updated for new pipeline/data/ directory layout.
Related Files:
  aggregate-spells.js
  aggregate-monsters.js
  aggregate-magic-items.js
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
   PREDEFINED DATASET PRECEDENCE
   ========================================================= */
const datasetPrecedence = {
    'SRD': 0,
    'Third-Party': 1,
    'Custom': 2
};

function getDatasetPrecedence(datasetName) {
    return datasetPrecedence[datasetName] ?? 1;
}

/* =========================================================
   DUPLICATE-NAME DETECTION
   ========================================================= */
function detectDuplicateNames(records, domain) {
    const nameMap = new Map();

    for (const record of records) {
        const name = record.name;
        if (!nameMap.has(name)) nameMap.set(name, []);
        nameMap.get(name).push(record);
    }

    for (const [name, entries] of nameMap.entries()) {
        if (entries.length > 1) {
            logWarning(`Duplicate ${domain} name detected across datasets: "${name}"`);
            for (const r of entries) {
                logWarning(`  - ${r.id} (${r._dataset || 'unknown dataset'})`);
            }
        }
    }
}

/* =========================================================
   CORE AGGREGATION FUNCTION
   ========================================================= */
export function aggregateBatch(
    datasets,
    datasetNames,
    domain,
    sortFn = (a, b) => a.name.localeCompare(b.name),
    mergeFn = null
) {
    if (!Array.isArray(datasets) || !Array.isArray(datasetNames) || datasets.length !== datasetNames.length) {
        throw new Error(`datasets and datasetNames must be arrays of equal length`);
    }

    logInfo(`Aggregating ${datasets.length} normalized ${domain} datasets`);

    const mergedRecords = [];
    const seenIds = new Map();

    datasets.forEach((dataset, index) => {
        const datasetName = datasetNames[index];
        const precedence = getDatasetPrecedence(datasetName);
    
        // ✅ Guard: skip if dataset is not a valid array
        if (!Array.isArray(dataset)) {
            logWarning(`Dataset "${datasetName}" is not an array (got ${dataset === null ? 'null' : typeof dataset}) — skipping`);
            return;
        }
    
        logInfo(`Processing dataset "${datasetName}" with precedence ${precedence} (${dataset.length} records)`);
    
        dataset.forEach(record => {
            // ✅ Guard: skip null/undefined records
            if (record == null) {
                logWarning(`Null record encountered in dataset "${datasetName}" — skipping`);
                return;
            }
            trackProvenance(record, datasetName, domain);
            record._datasetPrecedence = precedence;
            record._dataset = datasetName; // for duplicate-name logging

            if (mergeFn && seenIds.has(record.id)) {
                const existing = seenIds.get(record.id);
                const merged = mergeFn(existing, record);
                mergedRecords[mergedRecords.indexOf(existing)] = merged;
                seenIds.set(record.id, merged);
            } else if (!seenIds.has(record.id)) {
                mergedRecords.push(record);
                seenIds.set(record.id, record);
            } else {
                logWarning(`Duplicate ID skipped during aggregation: ${record.id}`);
            }
        });
    });

    detectDuplicateNames(mergedRecords, domain);

    // Deterministic ordering: dataset precedence → canonical sort key
    logInfo(`Applying deterministic ordering for ${domain} (dataset precedence → canonical sort)`);
    mergedRecords.sort((a, b) => {
        const precDiff = a._datasetPrecedence - b._datasetPrecedence;
        if (precDiff !== 0) return precDiff;
        return sortFn(a, b);
    });

    mergedRecords.forEach(r => {
        delete r._datasetPrecedence;
        delete r._dataset;
    });

    logInfo(`Aggregation complete for domain "${domain}"`);
    logInfo(`Datasets merged: ${datasets.length}`);
    logInfo(`Final record count: ${mergedRecords.length}`);

    return mergedRecords;
}

/**
 * Default merge function: shallow merge of fields
 */
export function mergeRecords(existing, incoming) {
    return { ...existing, ...incoming };
}