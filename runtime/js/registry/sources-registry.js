/* ---------------------------------------------------------
Path: runtime/js/registry/sources-registry.js
File: sources-registry.js
Version: V1.0
Data Schema: N/A
System: D&D Reference System – Reference System Runtime (RSR)
Module/Role: Runtime singleton registry for source records.
  Provides O(1) lookup of source records by ID. Initialized at
  startup by dataset-registry.js from the sources domain data.
  Exposes addSource() for runtime mutation by the future add/edit
  system — new sources added during a session are immediately
  visible to renderSources() without a page reload.
Dependencies: None
Created: 2026-04-26
Last Updated: 2026-04-26
Author: Bruce Pilcher
Changelog:
  V1.0: Initial release.
    - initSources(data): bulk loads from sources dataset array;
      clears existing map first so safe to call again if needed.
    - resolveSource(id): returns full source record or null.
    - addSource(record): adds or overwrites a single source record;
      validates that record.id is present.
Related Files:
  runtime/js/registry/dataset-registry.js
  runtime/js/renderers/render-helpers.js
Notes:
  - Map is module-level state; one instance per page lifecycle.
  - resolveSource() returns the full record { id, name, short,
    publisher, year } so callers can access any field without a
    second lookup. render-helpers.js uses .name; future tooltip
    and filter work can use .short, .publisher, .year freely.
  - addSource() is intentionally minimal — validation and
    persistence are the add/edit system's responsibility.
  - No export of the internal Map; all access goes through the
    three exported functions to keep the API surface stable.
--------------------------------------------------------- */

/* ---------------------------------------------------------
   Internal State
--------------------------------------------------------- */

/** @type {Map<string, Object>} */
const sourcesMap = new Map();

/* ---------------------------------------------------------
   Public API
--------------------------------------------------------- */

/**
 * Bulk-initialize the registry from the sources dataset array.
 * Clears any existing entries first — safe to call again if the
 * sources dataset is reloaded (e.g. during testing or hot reload).
 *
 * Called once by dataset-registry.js immediately after the sources
 * domain data is loaded, before any other domain is initialized.
 *
 * @param {Array<Object>} data - array of source records, each with at least { id, name }
 */
export function initSources(data) {
  sourcesMap.clear();

  if (!Array.isArray(data)) {
    console.warn("[SourcesRegistry] initSources() received non-array — registry will be empty.");
    return;
  }

  for (const record of data) {
    if (!record.id) {
      console.warn("[SourcesRegistry] Skipping source record with missing id:", record);
      continue;
    }
    sourcesMap.set(record.id, record);
  }

  console.log(`[SourcesRegistry] Initialized with ${sourcesMap.size} source records.`);
}

/**
 * Resolve a source ID to its full record.
 * Returns null if the ID is not found — callers should fall back
 * to displaying the raw ID string.
 *
 * @param {string} id - source ID (e.g. "srd-2014")
 * @returns {Object|null} full source record or null
 */
export function resolveSource(id) {
  return sourcesMap.get(id) ?? null;
}

/**
 * Add or overwrite a single source record at runtime.
 * Called by the add/edit system when a user creates a new source
 * that does not yet exist in the sources dataset. The new record
 * is immediately visible to resolveSource() in the same session.
 *
 * Validation and persistence to the user dataset are the
 * add/edit system's responsibility — this function only updates
 * the in-memory registry.
 *
 * @param {Object} record - source record; must include { id, name }
 */
export function addSource(record) {
  if (!record?.id) {
    console.warn("[SourcesRegistry] addSource() called with missing id — ignored:", record);
    return;
  }
  sourcesMap.set(record.id, record);
  console.log(`[SourcesRegistry] Source added/updated: "${record.id}"`);
}
