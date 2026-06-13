/* --------------------------------------------------------- */
// Path:         runtime/js/validators/validator.js
// File:         validator.js
// Version:      V1.2
// Data Schema:  V1.1
// System:       D&D Reference System – Reference System Runtime (RSR)
// Module/Role:  Centralised render request validation authority;
//               aggregates domain validation registries and enforces
//               valid (domain, viewType, renderMode) combinations at runtime
// Dependencies: runtime/js/validators/spells/registry.js
//               runtime/js/validators/monsters/registry.js
//               runtime/js/validators/magic-items/registry.js
// Created:      2026-04-05
// Last Updated: 2026-04-11
// Author:       Bruce Pilcher
// Changelog:
//   V1.0: Initial implementation; registry-driven validation
//   V1.1: Added monsters domain registry
//   V1.2: Added magic-items domain registry
// Related Files:
//   runtime/js/render-dispatcher.js
//   runtime/js/validators/spells/registry.js
//   runtime/js/validators/monsters/registry.js
//   runtime/js/validators/magic-items/registry.js
// Notes:
//   - Adding a new domain requires one import and one entry in
//     loadRegistries() — zero changes to dispatcher or core modules
//   - Mirrors architecture of resolve-template.js by design
/* --------------------------------------------------------- */

import { spellsValidation }      from "./spells/registry.js";
import { monstersValidation }    from "./monsters/registry.js";
import { magicItemsValidatorRegistry } from "./magic-items/registry.js";

/**
 * Registry Loader
 * To add a new domain: import its registry above and add it here.
 */
function loadRegistries() {
  return [
    spellsValidation,
    monstersValidation,
    magicItemsValidatorRegistry,
  ];
}

/**
 * Build unified registry at runtime
 */
function buildRegistry() {
  return Object.assign({}, ...loadRegistries());
}

/**
 * Validate a render request against registered domain combinations.
 * Throws descriptively on any contract violation.
 *
 * @param {Object} params
 * @param {string} params.domain
 * @param {string} params.viewType
 * @param {string} params.renderMode
 */
export function validateRenderRequest({ domain, viewType, renderMode }) {
  if (!domain || !viewType || !renderMode) {
    throw new Error(
      `[Validation] Missing required parameters (${domain}/${viewType}/${renderMode})`
    );
  }

  const registry = buildRegistry();
  const key = `${domain}.${viewType}.${renderMode}`;

  if (!registry[key]) {
    throw new Error(
      `[Validation] No registered combination for: ${key}. ` +
      `Register this combination in runtime/js/validators/${domain}/registry.js`
    );
  }
}
