/* --------------------------------------------------------- */
// Path:         runtime/js/resolve-template.js
// File:         resolve-template.js
// Version:      V2.0
// Data Schema:  V1.1
// System:       D&D Reference System – Reference System Runtime (RSR)
// Module/Role:  Dynamic template resolution engine; aggregates domain
//               registries at runtime and resolves templates via
//               (domain, viewType, renderMode) composite key lookup
// Dependencies: runtime/js/templates/spells/registry.js
//               runtime/js/templates/monsters/registry.js
//               runtime/js/templates/magic-items/registry.js
// Created:      2026-03-24
// Last Updated: 2026-04-11
// Author:       Bruce Pilcher
// Changelog:
//   V1.0: Initial stub implementation for template resolution
//   V1.3: Aligned resolution contract to (domain, viewType, renderMode) key structure
//   V1.4: Introduced registry-based template lookup model; removed hardcoded template logic
//   V1.5: Formalized registry-based template resolution engine
//   V1.7: Introduced dynamic registry aggregation system; loadRegistries() pattern
//   V1.8: Moved from runtime/js/templates/ to runtime/js/
//   V1.9: Added monsters domain registry
//   V2.0: Added magic-items domain registry
// Related Files:
//   runtime/js/render-dispatcher.js
//   runtime/js/templates/spells/registry.js
//   runtime/js/templates/monsters/registry.js
//   runtime/js/templates/magic-items/registry.js
// Notes:
//   - Key resolution contract: `${domain}.${viewType}.${renderMode}`
//   - Missing template resolution is a hard fail by design
//   - Future evolution target: filesystem-based or import-map-based registry injection
/* --------------------------------------------------------- */

import { spellsRegistry }      from "./templates/spells/registry.js";
import { monstersRegistry }    from "./templates/monsters/registry.js";
import { magicItemsRegistry } from "./templates/magic-items/registry.js";

/**
 * Registry Loader
 * To add a new domain: import its registry above and add it here.
 */
function loadRegistries() {
  return [
    spellsRegistry,
    monstersRegistry,
    magicItemsRegistry,
  ];
}

/**
 * Build unified registry at runtime
 */
function buildRegistry() {
  return Object.assign({}, ...loadRegistries());
}

/**
 * Resolve template from registry.
 * Throws descriptively on any missing registration.
 *
 * @param {Object} params
 * @param {string} params.domain
 * @param {string} params.viewType
 * @param {string} params.renderMode
 * @returns {Object} template object
 */
export function resolveTemplate({ domain, viewType, renderMode }) {
  const registry = buildRegistry();
  const key = `${domain}.${viewType}.${renderMode}`;
  const template = registry[key];

  if (!template) {
    throw new Error(
      `[TemplateResolver] No template registered for: ${key}`
    );
  }

  return template;
}
