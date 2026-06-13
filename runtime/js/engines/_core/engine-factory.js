/* ---------------------------------------------------------
Path: runtime/js/engines/_core/engine-factory.js
File: engine-factory.js
Version: V2.5
Data Schema: V1.1
System: D&D Reference System – Reference Engine (Query Layer)
Module/Role: Query engine factory (data layer); produces
  deterministic, read-only query engines for dataset access
Dependencies:
  - runtime/js/engines/_core/engine-composite.js
Created: 2026-03-24
Last Updated: 2026-06-05
Author: Bruce Pilcher
Changelog:
  V2.5:
    - createEngine now accepts optional `comparators` map
    - applySort checks comparators[field] before falling back
      to generic < / > comparison
    - Enables domain-specific sort order (e.g. rarity rank)
      without leaking domain knowledge into this file
    - Unknown comparator values sort to the start (rank -1)
      by convention; each domain comparator is responsible
      for its own sentinel value
  V2.4:
    - matchesCriteria: added range branch — filter value
      { min, max } applies >= / <= numeric comparison;
      either bound is optional
    - matchesCriteria: added text branch — filter value
      { text: string } applies case-insensitive substring
      match against string record values
    - validateQuery: range and text filter values are objects,
      not scalars — validation skips unknown-field check for
      these shapes (field name is still validated against schema)
  V2.3:
    - getComposite now passes sources to resolveComposite as
      injected parameter rather than relying on composite
      pulling from registry
    - Completes dataset injection contract: factory owns all
      data dependencies and passes them explicitly
  V2.2:
    - Moved from runtime/js/ to runtime/js/engines/_core/
    - Aligns with _core infrastructure pattern per Directory
      Contract V5.3
  V2.1:
    - Aligned header with correct system classification
    - Documented immutability, determinism, and dataset
      contract assumptions
    - Clarified runtime overlay behaviour and composite
      delegation
  V2.0:
    - Converted to ES Module architecture
    - Removed IIFE and global window bindings
    - Fully aligned with ESM-based architecture
  V1.5:
    - Implemented full Query Contract V1.0 validation layer
Related Files:
  - runtime/js/engines/_core/engine-composite.js
  - runtime/js/registry/dataset-registry-api.js
Notes:
  - Pure data-layer module (no DOM, no rendering responsibilities)
  - Deterministic: same query → same result
  - Immutable outputs: all returned data is frozen
  - Does NOT mutate source dataset
  - Range filter shape: { min?: number, max?: number }
  - Text filter shape:  { text: string }
  - Both shapes are produced by reference-service.js from
    URL params before reaching this layer
  - Delegates include expansion to engine-composite layer

  Domain-Specific Sort Comparators
  ---------------------------------
  createEngine accepts an optional `comparators` map:

    comparators: {
      fieldName: (value) => number
    }

  Each comparator is a function that maps a field value to a
  numeric rank. applySort uses the rank for comparison when a
  comparator exists for the active sort field, and falls back
  to generic < / > otherwise.

  Convention for unknown values:
    Return -1 (or any sentinel below your lowest valid rank)
    to sort unknowns to the start of the list. This is the
    project-wide default. Individual comparators are free to
    use a different sentinel if the domain requires it, but
    -1 is the expected convention.

  Adding a comparator for a new domain:
    1. Define a rank map in the domain's engine file
       (e.g. engine-magic-items.js, engine-spells.js).
    2. Write a comparator function that looks up the rank,
       returning -1 for unrecognised values.
    3. Pass { comparators: { fieldName: comparatorFn } }
       to createEngine.
    4. No changes to engine-factory.js are needed.

  See engine-magic-items.js for a worked example (rarity).
--------------------------------------------------------- */

import { resolveComposite } from "./engine-composite.js";

export function createEngine({ data, indexes = null, sources = null, comparators = {} }) {
  if (!Array.isArray(data)) {
    throw new Error("Engine initialization failed: 'data' must be an array");
  }

  // === PIPELINE DATA (IMMUTABLE) ===
  const dataset = Object.freeze([...data]);

  // === COMPARATORS (DOMAIN-SPECIFIC SORT FUNCTIONS) ===
  const fieldComparators = comparators && typeof comparators === "object"
    ? comparators
    : {};

  // === RUNTIME OVERLAY (EPHEMERAL) ===
  let runtimeOverlay = [];

  function setEphemeralRecords(records = []) {
    if (!Array.isArray(records)) {
      throw new Error("Ephemeral records must be an array");
    }
    runtimeOverlay = Object.freeze(
      records.map(r => Object.freeze({ ...r }))
    );
  }

  function getRuntimeDataset() {
    if (!runtimeOverlay.length) return dataset;
    return [...dataset, ...runtimeOverlay];
  }

  /* ---------------------------------------------------------
     INTERNAL: Validate query against dataset structure
     Enforces Query Contract V1.0
  --------------------------------------------------------- */
  function validateQuery(query = {}) {
    const schemaFields = dataset.length ? Object.keys(dataset[0]) : [];

    // --- FILTER VALIDATION ---
    if (query.filter) {
      Object.keys(query.filter).forEach(field => {
        if (!schemaFields.includes(field)) {
          throw new Error(`Invalid query: unknown filter field "${field}"`);
        }
        // Range and text filter values are objects — no further
        // scalar validation needed for those shapes
      });
    }

    // --- SORT VALIDATION ---
    if (query.sort) {
      const { field, order } = query.sort;
      if (!field || !schemaFields.includes(field)) {
        throw new Error(`Invalid query: unknown sort field "${field}"`);
      }
      if (!["asc", "desc"].includes(order)) {
        throw new Error(`Invalid query: sort order must be "asc" or "desc"`);
      }
    }

    // --- PAGINATION VALIDATION ---
    if (query.limit !== null && query.limit !== undefined) {
      if (typeof query.limit !== "number" || query.limit < 0) {
        throw new Error(`Invalid query: "limit" must be a non-negative number`);
      }
    }
    if (query.offset !== null && query.offset !== undefined) {
      if (typeof query.offset !== "number" || query.offset < 0) {
        throw new Error(`Invalid query: "offset" must be a non-negative number`);
      }
    }

    // --- INCLUDE VALIDATION ---
    if (query.include) {
      if (!Array.isArray(query.include)) {
        throw new Error(`Invalid query: "include" must be an array`);
      }
      const allowedIncludes = ["source"];
      query.include.forEach(inc => {
        if (!allowedIncludes.includes(inc)) {
          throw new Error(`Invalid query: unknown include "${inc}"`);
        }
      });
    }
  }

  /* ---------------------------------------------------------
     matchesCriteria — supports three filter value shapes:
       1. Range:  { min?, max? }  → numeric >= / <=
       2. Text:   { text: string } → case-insensitive substring
       3. Scalar: string | number | boolean → equality
                  (arrays in record use .includes())
  --------------------------------------------------------- */
  function matchesCriteria(record, criteria = {}) {
    return Object.entries(criteria).every(([key, value]) => {
      if (value === undefined) return true;

      const recordValue = record[key];

      // --- Range filter: { min?, max? }
      if (
        value !== null &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        ("min" in value || "max" in value)
      ) {
        const num = Number(recordValue);
        if (isNaN(num)) return false;
        if (value.min !== undefined && num < value.min) return false;
        if (value.max !== undefined && num > value.max) return false;
        return true;
      }

      // --- Text filter: { text: string }
      if (
        value !== null &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        "text" in value
      ) {
        if (typeof recordValue !== "string") return false;
        return recordValue.toLowerCase().includes(
          value.text.toLowerCase()
        );
      }

      // --- Array record value: check membership
      if (Array.isArray(recordValue)) {
        return recordValue.includes(value);
      }

      // --- String equality (case-insensitive)
      if (typeof recordValue === "string" && typeof value === "string") {
        return recordValue.toLowerCase() === value.toLowerCase();
      }

      // --- Scalar equality (number, boolean)
      return recordValue === value;
    });
  }

  function applyFilter(dataSubset, filter) {
    return dataSubset.filter(record => matchesCriteria(record, filter));
  }

  /* ---------------------------------------------------------
     applySort — uses a domain comparator if one is registered
     for the active sort field; falls back to generic < / >.

     Comparator contract:
       comparators[field](value) → number
       Unknown values should return -1 (sorts to start).
     Tie-break: stable sort on id via localeCompare.
  --------------------------------------------------------- */
  function applySort(dataSubset, sort) {
    const { field, order } = sort;
    const comparator = fieldComparators[field];

    return [...dataSubset].sort((a, b) => {
      let rankA, rankB;

      if (comparator) {
        rankA = comparator(a[field]);
        rankB = comparator(b[field]);
      } else {
        rankA = a[field];
        rankB = b[field];
      }

      if (rankA < rankB) return order === "asc" ? -1 : 1;
      if (rankA > rankB) return order === "asc" ?  1 : -1;
      return a.id.localeCompare(b.id);
    });
  }

  function lookupByIndex(criteria) {
    if (!indexes || !criteria) return null;
    const keys = Object.keys(criteria);
    if (keys.length !== 1) return null;
    const field = keys[0];
    const value = criteria[field];
    const index = indexes[field];
    if (!index) return null;
    return index[value] || null;
  }

  /* ---------------------------------------------------------
     ENTITY QUERY
  --------------------------------------------------------- */
  function getEntity(criteria = {}) {
    if (!criteria || Object.keys(criteria).length === 0) {
      throw new Error("getEntity requires non-empty criteria");
    }
    validateQuery({ filter: criteria });
    const runtimeData = getRuntimeDataset();
    const indexed = lookupByIndex(criteria);
    if (indexed) return Object.freeze(indexed);
    const result = runtimeData.find(
      record => matchesCriteria(record, criteria)
    );
    return result ? Object.freeze(result) : null;
  }

  /* ---------------------------------------------------------
     COLLECTION QUERY
  --------------------------------------------------------- */
  function getCollection(query = {}) {
    validateQuery(query);
    const {
      filter = null,
      sort   = null,
      limit  = null,
      offset = 0
    } = query;

    let results = [...getRuntimeDataset()];
    if (filter) results = applyFilter(results, filter);
    if (sort)   results = applySort(results, sort);
    if (offset) results = results.slice(offset);
    if (limit !== null) results = results.slice(0, limit);

    return Object.freeze(results);
  }

  /* ---------------------------------------------------------
     COMPOSITE QUERY
  --------------------------------------------------------- */
  function getComposite(query = {}) {
    const { id = null, include = [] } = query;
    if (!id) throw new Error("getComposite requires 'id'");
    validateQuery(query);
    const base = getEntity({ id });
    if (!base) return null;
    return resolveComposite(base, include, { sources });
  }

  return Object.freeze({
    getEntity,
    getCollection,
    getComposite,
    setEphemeralRecords
  });
}
