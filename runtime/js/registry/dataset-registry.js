/* ---------------------------------------------------------
Path: runtime/js/registry/dataset-registry.js
File: dataset-registry.js
Version: V6.2
Data Schema: V1.1
System: DnD-RSR — D&D 5e Dynamic Reference System
Module/Role: Runtime dataset registry; async ESM initialization,
  dataset loading, engine creation, and domain access API

Dependencies:
  - runtime/js/registry/datasets.js
  - runtime/js/registry/dataset-registry-validator.js
  - runtime/js/registry/sources-registry.js
  - runtime/js/engines/_core/engine-factory.js
  - runtime/js/_core/domain-config.js

Created: 2026-03-18
Last Updated: 2026-06-07
Author: Bruce Pilcher
Changelog:
  V6.2:
    - Added import of loadDomainConfig from domain-config.js
    - In domain loop: loads domain config and passes comparators
      map to createEngine(). Empty config → comparators: {} →
      zero regression risk on domains with no config file.
  V6.1:
    - Added import of initSources from ./sources-registry.js
    - initSources(sourcesData) called immediately after sources
      domain data is loaded, before the domain loop. This wires
      the sources singleton so renderSources() can resolve IDs
      to display names at render time.
  V6.0:
    - Fixed import path for engine-factory (engines/_core/)
    - Fixed loader to read ds.source instead of ds.path
    - Deferred datasets.user.json to step 17 (add/edit workflow)
    - Added getEngine() as named export for referenceService
    - Added sources domain injection into createEngine()
    - Added isInitialized() export for defensive checks
    - Removed dataset-registry-validator import path error
    - Registry is now fully wirable into the active slice
  V5.0:
    - Converted to fully ESM-based dataset loading
    - initializeRegistry() now async and idempotent
Related Files:
  - runtime/js/registry/datasets.js
  - runtime/js/registry/dataset-registry-validator.js
  - runtime/js/registry/sources-registry.js
  - runtime/js/engines/_core/engine-factory.js
  - runtime/js/_core/domain-config.js
  - runtime/js/reference-service.js
Notes:
  - datasets.user.json deferred until step 17 (add/edit workflow)
  - Initialization is async and idempotent
  - sources domain MUST be present in systemDatasets and loaded first
  - initSources() must be called before the domain loop so that
    source resolution is available to all renderers from first render
  - getEngine(domain) is the primary API for referenceService
  - loadDomainConfig() is safe for all domains — 404 returns empty
    config; comparators: {} passed to createEngine() → no-op
  - Transitional: dataset paths point to data/ normalized files
    until packaging layer is built
--------------------------------------------------------- */

import { systemDatasets } from "./datasets.js";
import { validateRegistry } from "./dataset-registry-validator.js";
import { initSources } from "./sources-registry.js";
import { createEngine } from "../engines/_core/engine-factory.js";
import { loadDomainConfig } from "../_core/domain-config.js";

/* =========================================================
   INTERNAL STATE
========================================================= */

const registryState = {
  initialized: false,
  domains: {}
};

/* =========================================================
   INITIALIZATION
========================================================= */

export async function initializeRegistry() {
  if (registryState.initialized) {
    console.warn("[Registry] Already initialized — skipping.");
    return;
  }

  // datasets.user.json deferred until step 17
  // When ready: import and merge with systemDatasets here
  const config = systemDatasets;

  validateRegistry(config);

  // Load sources first — required by all domains for composite resolution
  const sourcesData = await loadDomainData(config, "sources");

  // Initialize the sources singleton so renderSources() can resolve
  // source IDs to display names from this point forward
  initSources(sourcesData);

  for (const domain in config) {
    const domainConfig = config[domain];
    const enabledDatasets = getEnabledDatasets(domainConfig.datasets);

    if (enabledDatasets.length === 0) {
      console.warn(`[Registry] No enabled datasets for domain "${domain}"`);
      continue;
    }

    const orderedDatasets = sortDatasetsByPriority(enabledDatasets);
    const resolved = {
      datasets: orderedDatasets,
      primary: orderedDatasets[0] || null
    };

    const data = await loadDatasetArtifacts(resolved);
    const indexes = await loadIndexArtifacts(resolved);

    if (!data || data.length === 0) {
      console.warn(`[Registry] Empty dataset for domain "${domain}"`);
    }

    // Load domain controlled vocabulary config and extract comparators.
    // 404 or missing config → empty comparators map → no behaviour change.
    const domainCfg   = await loadDomainConfig(domain);
    const comparators = domainCfg.getAllComparators();

    // Inject sources for composite resolution and domain comparators for sort
    const engine = createEngine({
      data,
      indexes: indexes.length ? indexes : null,
      sources: domain === "sources" ? null : sourcesData,
      comparators
    });

    registryState.domains[domain] = {
      datasets: domainConfig.datasets,
      resolved,
      data,
      indexes,
      engine
    };
  }

  registryState.initialized = true;
  console.log("[Registry] Initialization complete ✅");
}

/* =========================================================
   PUBLIC API
========================================================= */

/**
 * Get engine for a domain.
 * Used by referenceService to query data.
 */
export function getEngine(domain) {
  if (!registryState.initialized) {
    throw new Error(
      `[Registry] Not initialized. Call initializeRegistry() before getEngine().`
    );
  }

  const domainState = registryState.domains[domain];

  if (!domainState) {
    throw new Error(
      `[Registry] Domain "${domain}" not found. ` +
      `Is it defined in datasets.js and does its dataset file exist?`
    );
  }

  return domainState.engine;
}

/**
 * Check initialization state.
 * Useful for defensive checks in referenceService.
 */
export function isInitialized() {
  return registryState.initialized;
}

/* =========================================================
   INTERNAL: DOMAIN LOADING HELPER
========================================================= */

async function loadDomainData(config, domain) {
  const domainConfig = config[domain];
  if (!domainConfig) return [];

  const enabled = getEnabledDatasets(domainConfig.datasets);
  if (!enabled.length) return [];

  const ordered = sortDatasetsByPriority(enabled);
  return await loadDatasetArtifacts({ datasets: ordered });
}

/* =========================================================
   CONFIG HELPERS
========================================================= */

function getEnabledDatasets(datasets) {
  return datasets.filter(ds => ds.enabled);
}

function sortDatasetsByPriority(datasets) {
  return [...datasets].sort((a, b) => (b.priority || 0) - (a.priority || 0));
}

/* =========================================================
   DATA LOADING (ESM)
========================================================= */

async function loadDatasetArtifacts(resolved) {
  const results = [];
  const seenIds = new Set();

  for (const ds of resolved.datasets) {
    // Uses ds.source per validator contract (not ds.path)
    if (!ds.source) {
      console.warn(`[Registry] Dataset "${ds.id}" has no source path — skipping.`);
      continue;
    }

    const module = await import(ds.source);
    const data = module?.default;

    if (!Array.isArray(data)) {
      throw new Error(
        `[Registry] Dataset "${ds.id}" must export a default array. ` +
        `Check the export format of ${ds.source}`
      );
    }

    for (const record of data) {
      if (!record.id) {
        throw new Error(
          `[Registry] Missing record.id in dataset "${ds.id}". ` +
          `All records must have a stable id field.`
        );
      }
      if (seenIds.has(record.id)) {
        throw new Error(
          `[Registry] Duplicate record.id "${record.id}" in dataset "${ds.id}".`
        );
      }
      seenIds.add(record.id);
      results.push(record);
    }
  }

  return results;
}

async function loadIndexArtifacts(resolved) {
  const indexes = [];

  for (const ds of resolved.datasets) {
    if (!ds.index) continue;
    try {
      const module = await import(ds.index);
      if (module) indexes.push(module);
    } catch (err) {
      console.warn(
        `[Registry] Failed to load index at "${ds.index}":`, err
      );
    }
  }

  return indexes;
}

/* =========================================================
   INTERNAL STATE ACCESS
========================================================= */

export function _getRegistryState() {
  return registryState;
}
