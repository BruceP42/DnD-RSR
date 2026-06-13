/* --------------------------------------------------------- */
/*
  Path:         runtime/js/_core/domain-config.js
  File:         domain-config.js
  Version:      V1.0
  Data Schema:  n/a
  System:       DnD-RSR — D&D 5e Dynamic Reference System
  Module/Role:  Config loader — fetches config/<domain>-config.json,
                caches results, and exposes vocab lists and sort
                comparators for all consumers (engines, forms, filter bar).
  Dependencies: None — vanilla fetch only
  Created:      2026-06-07
  Last Updated: 2026-06-07
  Changelog:    V1.0: Initial creation
  Notes:
    - Fetches from ${window.location.origin}/config/<domain>-config.json
    - Results cached in module-level Map; each domain loaded at most once
    - 404 or network error → returns empty config object, no throw
    - Config JSON values are Title Case; comparators normalise both sides
      to lowercase before rank lookup
    - Unknown vocab values → rank -1 (sort to start) — project convention
    - ordered: true  → comparator built automatically from values array
    - ordered: false → no comparator built; sort falls back to generic
*/
/* --------------------------------------------------------- */

const _cache = new Map();

/**
 * Fetches and caches a domain config file.
 * Returns a config object with helper methods.
 *
 * @param {string} domain  e.g. "magic-items", "monsters", "spells"
 * @returns {Promise<DomainConfig>}
 */
export async function loadDomainConfig(domain) {
  if (_cache.has(domain)) {
    return _cache.get(domain);
  }

  let vocabs = {};

  try {
    const url      = `${window.location.origin}/config/${domain}-config.json`;
    const response = await fetch(url);

    if (response.ok) {
      const json = await response.json();
      vocabs = json.controlledVocabularies || {};
    }
    // 404 or any non-ok status → leave vocabs as {}; no throw
  } catch (_err) {
    // Network error or JSON parse failure → leave vocabs as {}; no throw
  }

  const config = _buildConfig(vocabs);
  _cache.set(domain, config);
  return config;
}

/* --------------------------------------------------------- */
/* Internal                                                  */
/* --------------------------------------------------------- */

/**
 * Builds a config object from a raw controlledVocabularies map.
 *
 * @param {Object} vocabs  Raw vocab definitions from JSON
 * @returns {DomainConfig}
 */
function _buildConfig(vocabs) {
  // Pre-build comparators for all ordered fields
  const comparatorMap = {};

  for (const [field, def] of Object.entries(vocabs)) {
    if (def.ordered && Array.isArray(def.values)) {
      comparatorMap[field] = _buildComparator(def.values);
    }
  }

  return {
    /**
     * Returns the values array for a field, or null if not defined.
     * Values are returned in their original Title Case form.
     *
     * @param {string} field
     * @returns {string[]|null}
     */
    getValues(field) {
      const def = vocabs[field];
      return (def && Array.isArray(def.values)) ? def.values : null;
    },

    /**
     * Returns the sort comparator for an ordered field, or null if
     * the field is unordered or not defined.
     *
     * @param {string} field
     * @returns {((value: string) => number)|null}
     */
    getComparator(field) {
      return comparatorMap[field] || null;
    },

    /**
     * Returns all comparators as a plain object keyed by field name.
     * Only ordered fields are present. Pass directly to createEngine().
     *
     * @returns {{ [field: string]: (value: string) => number }}
     */
    getAllComparators() {
      return { ...comparatorMap };
    }
  };
}

/**
 * Builds a rank-based comparator function from an ordered values array.
 * Both the lookup table and incoming values are normalised to lowercase.
 * Unknown values receive rank -1 (sort to start) — project convention.
 *
 * @param {string[]} orderedValues  Title Case values in canonical sort order
 * @returns {(value: string) => number}
 */
function _buildComparator(orderedValues) {
  const rankMap = new Map(
    orderedValues.map((v, i) => [v.toLowerCase(), i])
  );

  return function comparator(value) {
    const rank = rankMap.get(String(value).toLowerCase());
    return rank !== undefined ? rank : -1;
  };
}
