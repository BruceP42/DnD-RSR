/*
 * Path:         runtime/js/validators/monsters/
 * File:         registry.js
 * Version:      1.0.0
 * Data Schema:  N/A
 * System:       D&D Reference System Runtime (RSR)
 * Module/Role:  Validator registry — declares valid domain/viewType/renderMode combinations for monsters
 *
 * Dependencies:
 *   - runtime/js/validators/validator.js (imports this registry)
 *
 * Created:      2025
 * Last Updated: 2025
 * Author:       [Author]
 *
 * Changelog:
 *   1.0.0 — Initial release with summary/table, entity/card, entity/stat-block
 *
 * Related Files:
 *   runtime/js/renderers/monsters/registry.js
 *   runtime/js/templates/monsters/registry.js
 *   runtime/js/validators/validator.js
 *
 * Notes:
 *   Keys follow the composite pattern: domain.viewType.renderMode.
 *   Any combination not listed here will be rejected by the validator before rendering begins.
 *   To add a new render mode, add a key here and mirror it in the renderer and template registries.
 */

export const monstersValidation = {
  "monsters.summary.table":      true,
  "monsters.entity.card":        true,
  "monsters.entity.stat-block":  true
};