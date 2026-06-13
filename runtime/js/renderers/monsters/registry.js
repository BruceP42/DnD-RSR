/*
 * Path:         runtime/js/renderers/monsters/
 * File:         registry.js
 * Version:      1.0.0
 * Data Schema:  N/A
 * System:       D&D Reference System Runtime (RSR)
 * Module/Role:  Renderer registry — maps composite keys to renderer functions for monsters domain
 *
 * Dependencies:
 *   - runtime/js/renderers/table-renderer.js
 *   - runtime/js/renderers/card-renderer.js
 *   - runtime/js/renderers/monsters/stat-block-renderer.js
 *
 * Created:      2025
 * Last Updated: 2025
 * Author:       [Author]
 *
 * Changelog:
 *   1.0.0 — Initial release with summary/table, entity/card, entity/stat-block
 *
 * Related Files:
 *   runtime/js/validators/monsters/registry.js
 *   runtime/js/templates/monsters/registry.js
 *   runtime/js/resolve-renderer.js
 *
 * Notes:
 *   Keys must stay in sync with validators/monsters/registry.js and templates/monsters/registry.js.
 *   table-renderer and card-renderer are shared domain-agnostic renderers.
 *   stat-block-renderer is monsters-specific and lives in this subdirectory.
 */

import { tableRenderer }     from "../table-renderer.js";
import { cardRenderer }      from "../card-renderer.js";
import { statBlockRenderer } from "./stat-block-renderer.js";

export const monstersRendererRegistry = {
  "monsters.summary.table":     tableRenderer,
  "monsters.entity.card":       cardRenderer,
  "monsters.entity.stat-block": statBlockRenderer
};