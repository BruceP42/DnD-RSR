/* ---------------------------------------------------------
Path: pipeline/utils/provenance.js
File: provenance.js
Version: V1.0
Data Schema: V1.1
System: D&D Reference System – Data Pipeline V3.0
Module/Role: Tracks dataset provenance during normalization and aggregation
Dependencies:
  - ./logging.js
Created: 2026-03-11
Last Updated: 2026-03-11
Author: Bruce Pilcher

Changelog:
  V1.0: Initial provenance tracking implementation for pipeline observability

Related Files:
  pipeline/_core/normalization-engine.js
  pipeline/_core/aggregation-engine.js
  pipeline/build-all.js
  pipeline/utils/logging.js

Notes:
  - Tracks which datasets contribute records to each domain.
  - Used for build observability and debugging dataset conflicts.
  - Does NOT modify records or affect aggregation behavior.
  - Designed to remain lightweight and deterministic.
--------------------------------------------------------- */

import { logInfo } from "./logging.js";


/* =========================================================
   INTERNAL PROVENANCE STORE
---------------------------------------------------------
Structure:

{
  domainName: {
      datasetName: {
          count: number,
          ids: []
      }
  }
}
========================================================= */

const provenanceStore = {};


/* =========================================================
   TRACK PROVENANCE
---------------------------------------------------------
Registers records originating from a dataset.

Parameters
----------
domain : string
    Domain name (spells, monsters, magicItems)

datasetName : string
    Source dataset identifier (spells-SRD, spells-custom)

records : array
    Array of normalized records
========================================================= */

export function trackProvenance(domain, datasetName, records) {

    if (!provenanceStore[domain]) {
        provenanceStore[domain] = {};
    }

    if (!provenanceStore[domain][datasetName]) {
        provenanceStore[domain][datasetName] = {
            count: 0,
            ids: []
        };
    }

    const datasetEntry = provenanceStore[domain][datasetName];

    datasetEntry.count += records.length;

    for (const record of records) {
        if (record.id) {
            datasetEntry.ids.push(record.id);
        }
    }
}


/* =========================================================
   GET PROVENANCE DATA
---------------------------------------------------------
Returns provenance data for a specific domain.

Used primarily for diagnostics or future reporting.
========================================================= */

export function getProvenance(domain) {
    return provenanceStore[domain] || {};
}


/* =========================================================
   PRINT PROVENANCE SUMMARY
---------------------------------------------------------
Outputs a concise provenance summary to the pipeline log.

Example output:

[pipeline][aggregation] INFO:
Provenance summary for spells
  spells-SRD → 319 records
  spells-custom → 1 record
========================================================= */

export function printProvenanceSummary(domain) {

    const domainData = provenanceStore[domain];

    if (!domainData) {
        logInfo(`No provenance data recorded for domain "${domain}"`, "aggregation");
        return;
    }

    logInfo(`Provenance summary for ${domain}:`, "aggregation");

    for (const datasetName of Object.keys(domainData)) {

        const entry = domainData[datasetName];

        logInfo(
            `${datasetName} → ${entry.count} records`,
            "aggregation"
        );
    }
}


/* =========================================================
   RESET PROVENANCE
---------------------------------------------------------
Clears provenance data.

Useful for:
  - deterministic test harness runs
  - rebuilding a domain multiple times
========================================================= */

export function resetProvenance(domain = null) {

    if (domain) {
        delete provenanceStore[domain];
        return;
    }

    for (const key of Object.keys(provenanceStore)) {
        delete provenanceStore[key];
    }
}