/* --------------------------------------------------------- */
// Path:         runtime/js/resolve-renderer.js
// File:         resolve-renderer.js
// Version:      V2.2
// Data Schema:  V1.1
// System:       D&D Reference System – Reference System Runtime (RSR)
// Module/Role:  Dynamic renderer resolution engine; aggregates domain
//               renderer registries at runtime and resolves the correct
//               renderer via (domain, viewType, renderMode) composite key lookup
// Dependencies: runtime/js/renderers/spells/registry.js
//               runtime/js/renderers/monsters/registry.js
//               runtime/js/renderers/magic-items/registry.js
// Created:      2026-03-24
// Last Updated: 2026-04-11
// Author:       Bruce Pilcher
// Changelog:
//   V1.0: Initial stub
//   V2.0: Full registry-driven implementation; moved to runtime/js/
//   V2.1: Added monsters domain registry
//   V2.2: Added magic-items domain registry
// Related Files:
//   runtime/js/render-dispatcher.js
//   runtime/js/resolve-template.js
//   runtime/js/renderers/spells/registry.js
//   runtime/js/renderers/monsters/registry.js
//   runtime/js/renderers/magic-items/registry.js
// Notes:
//   - Key resolution contract: domain.viewType.renderMode
//   - Missing renderer resolution is a hard fail by design
//   - Mirrors resolve-template.js pattern exactly
/* --------------------------------------------------------- */

import { spellsRendererRegistry }     from "./renderers/spells/registry.js";
import { monstersRendererRegistry }   from "./renderers/monsters/registry.js";
import { magicItemsRendererRegistry } from "./renderers/magic-items/registry.js";

/**
 * Registry Loader
 * To add a new domain: import its registry above and add it here.
 */
function loadRegistries() {
  return [
    spellsRendererRegistry,
    monstersRendererRegistry,
    magicItemsRendererRegistry,
  ];
}

/**
 * Build unified registry at runtime
 */
function buildRegistry() {
  return Object.assign({}, ...loadRegistries());
}

/**
 * Resolve renderer from registry.
 * Throws descriptively on any missing registration.
 *
 * @param {Object} params
 * @param {string} params.domain
 * @param {string} params.viewType
 * @param {string} params.renderMode
 * @returns {Object} renderer — must implement .render()
 */
export function resolveRenderer({ domain, viewType, renderMode }) {
  const registry = buildRegistry();
  const key = `${domain}.${viewType}.${renderMode}`;
  const renderer = registry[key];

  if (!renderer) {
    throw new Error(
      `[RendererResolver] No renderer registered for: ${key}. ` +
      `Register this renderer in runtime/js/renderers/${domain}/registry.js`
    );
  }

  return renderer;
}
