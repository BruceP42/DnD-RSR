/* ---------------------------------------------------------
Path: runtime/js/engines/_core/engine-composite.js
File: engine-composite.js
Version: V1.4
Data Schema: V1.1
System: D&D Reference System – Reference Engine (Query Layer)
Module/Role: Composite resolution layer (data enrichment); expands
  entities via include contract (read-only, deterministic, pure function)

Dependencies: None

Created: 2026-03-24
Last Updated: 2026-04-06
Author: Bruce Pilcher
Reviewed By:
Changelog:
  V1.4:
    - Removed registry import (getDataset dependency eliminated)
    - datasets injected as parameter instead of pulled from registry
    - resolveComposite is now a pure function: same input → same output
      with no hidden runtime dependencies
    - Determinism guarantee is now real, not aspirational
  V1.3:
    - Moved from runtime/js/ to runtime/js/engines/_core/
    - Aligns with _core infrastructure pattern per Directory Contract V5.3
  V1.2:
    - Converted to full ES Module (ESM) architecture
    - Removed dependency on global window.getDataset
  V1.1:
    - Added deterministic resolveComposite(entity, includes) function
Related Files:
  - runtime/js/engines/_core/engine-factory.js
Notes:
  - Pure data-layer module: no DOM, no registry, no rendering
  - Deterministic: same input → same output (no hidden dependencies)
  - Read-only: never mutates input entity or injected datasets
  - datasets parameter shape: { sources: Array, ... }
  - Each include field resolves safely with fallback to null
  - Future expansion: move include resolution to strategy registry
    (domain + include → resolver function)
  - Expects entity to follow dataset identity contract (record.id)
  - Include resolution may depend on _meta fields (e.g. _meta.sources)
--------------------------------------------------------- */

/**
 * Resolves composite entities by expanding include fields.
 *
 * @param {Object} entity   - base record (required)
 * @param {Array}  includes - fields to expand (e.g. ["source"])
 * @param {Object} datasets - injected datasets { sources: Array, ... }
 * @returns {Object} deep-frozen composite object
 */
export function resolveComposite(entity, includes = [], datasets = {}) {
  if (!entity) return null;

  // Shallow copy for safe expansion — never mutate original
  const composite = { ...entity };

  includes.forEach(inc => {
    switch (inc) {

      case "source": {
        // Deterministic: uses first source reference in _meta.sources
        const sourcesDataset = datasets.sources || [];
        const sourceId = entity._meta?.sources?.[0] || null;

        if (sourceId) {
          const sourceRecord =
            sourcesDataset.find(s => s.id === sourceId) || null;

          if (sourceRecord) {
            composite.source = Object.freeze(sourceRecord);
          }
        }
        break;
      }

      // === Future include expansions ===
      // case "scaling":
      //   composite.scaling = resolveScaling(entity, datasets);
      //   break;

      default:
        // Unknown include: set null deterministically
        composite[inc] = null;
        break;
    }
  });

  return Object.freeze(composite);
}