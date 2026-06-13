/* ---------------------------------------------------------
Path: runtime/js/reference-service.js
File: reference-service.js
Version: V2.1
Data Schema: V1.1
System: D&D Reference System – Reference System Runtime (RSR)
Module/Role: Engine-to-RSR bridge; queries domain engines via
  registry and delegates rendering to dispatcher. Owns all
  data access and query-building logic so controllers remain
  free of engine and dataset concerns.
Dependencies:
  - runtime/js/registry/dataset-registry.js
  - runtime/js/render-dispatcher.js
Created: 2026-04-06
Last Updated: 2026-04-12
Author: Bruce Pilcher
Changelog:
  V2.1:
    - Added BOOLEAN_FIELDS set; boolean string coercion now
      mirrors NUMERIC_FIELDS pattern
    - Added ac, cr, hp, xp to NUMERIC_FIELDS
    - coerceFilter now collapses range params: filter values
      that are objects { min?, max? } pass through as-is
      (controllers produce these after parseURL processing);
      range fields bypassed for scalar coercion
    - coerceFilter now coerces "true"/"false" strings to
      booleans for fields in BOOLEAN_FIELDS
    - Text filter values { text: string } pass through as-is
  V2.0:
    - Added sort, order, and filter params to render()
    - Builds engine query object from URL-derived params
    - Numeric field coercion for known numeric fields
    - Filter values coerced to correct types before engine query
  V1.0: Initial Engine→RSR bridge
Related Files:
  - runtime/js/registry/dataset-registry.js
  - runtime/js/render-dispatcher.js
  - runtime/js/controllers/spells-controller.js
  - runtime/js/controllers/monsters-controller.js
  - runtime/js/controllers/magic-items-controller.js
Notes:
  - NUMERIC_FIELDS: coerced from URL string → number
  - BOOLEAN_FIELDS: coerced from "true"/"false" → boolean
  - Range values { min?, max? } are already structured objects
    produced by parseURL in the controller — pass through only
  - Text values { text: string } similarly pass through only
  - Array fields (classes) match via engine .includes() —
    no special handling needed here
  - Adding new filterable fields may require adding to
    NUMERIC_FIELDS or BOOLEAN_FIELDS if type coercion is needed
--------------------------------------------------------- */

import { getEngine }        from "./registry/dataset-registry.js";
import { renderReference }  from "./render-dispatcher.js";

// Fields coerced from URL string → number
const NUMERIC_FIELDS = new Set([
  "level",
  "priority",
  "ac",
  "cr",
  "hp",
  "xp"
]);

// Fields coerced from URL string "true"/"false" → boolean
const BOOLEAN_FIELDS = new Set([
  "concentration",
  "ritual",
  "attunement"
]);

/**
 * Coerce filter values to correct types for engine query.
 * - Range objects { min?, max? } pass through unchanged
 * - Text objects  { text: string } pass through unchanged
 * - Numeric fields coerced string → number
 * - Boolean fields coerced "true"/"false" → boolean
 *
 * @param {Object} filter - filter from controller { field: value }
 * @returns {Object} coerced filter
 */
function coerceFilter(filter = {}) {
  const coerced = {};

  for (const [field, value] of Object.entries(filter)) {
    if (value === null || value === undefined || value === "") continue;

    // Range or text objects — already structured, pass through
    if (typeof value === "object" && !Array.isArray(value)) {
      coerced[field] = value;
      continue;
    }

    if (BOOLEAN_FIELDS.has(field)) {
      coerced[field] = value === true || value === "true";
      continue;
    }

    if (NUMERIC_FIELDS.has(field)) {
      const num = Number(value);
      coerced[field] = isNaN(num) ? value : num;
      continue;
    }

    coerced[field] = value;
  }

  return coerced;
}

/**
 * Build engine query object from service params.
 *
 * @param {Object} params
 * @returns {Object} engine query { filter?, sort? }
 */
function buildQuery({ sort, order, filter }) {
  const query = {};

  const coerced = coerceFilter(filter);
  if (Object.keys(coerced).length > 0) {
    query.filter = coerced;
  }

  if (sort) {
    query.sort = {
      field: sort,
      order: order || "asc"
    };
  }

  return query;
}

/**
 * Render a domain view by querying the engine and dispatching
 * to the renderer.
 *
 * @param {Object}  params
 * @param {string}  params.domain       - domain identifier
 * @param {string}  params.viewType     - "summary" | "entity"
 * @param {string}  params.renderMode   - "table" | "card"
 * @param {string}  [params.selectedId] - entity ID for card view
 * @param {string}  [params.sort]       - field to sort by
 * @param {string}  [params.order]      - "asc" | "desc"
 * @param {Object}  [params.filter]     - { field: value } pairs
 * @returns {Promise<string>} rendered HTML string
 */
export async function render({
  domain,
  viewType,
  renderMode,
  selectedId = null,
  sort       = null,
  order      = null,
  filter     = {}
}) {
  // 1. Get engine for domain
  const engine = getEngine(domain);

  // 2. Query engine for data
  let data;

  if (selectedId) {
    const entity = engine.getEntity({ id: selectedId });
    if (!entity) {
      throw new Error(
        `[ReferenceService] Entity not found for id: "${selectedId}" ` +
        `in domain "${domain}"`
      );
    }
    data = [entity];

  } else {
    const query = buildQuery({ sort, order, filter });
    data = engine.getCollection(query);
  }

  // 3. Dispatch to renderer
  return renderReference({
    domain,
    viewType,
    renderMode,
    data,
    selectedId
  });
}
