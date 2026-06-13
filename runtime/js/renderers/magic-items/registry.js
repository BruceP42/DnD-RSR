/* --------------------------------------------------------- */
// Path:         runtime/js/renderers/magic-items/registry.js
// File:         registry.js
// Version:      V1.0
// Data Schema:  V1.1
// System:       RSR (D&D Reference System)
// Module/Role:  Magic-items renderer registry — maps keys to renderer objects
// Dependencies: renderers/table-renderer.js, renderers/card-renderer.js
// Created:      2026-04-11
// Last Updated: 2026-04-11
/* --------------------------------------------------------- */

import { tableRenderer } from "../table-renderer.js";
import { cardRenderer }  from "../card-renderer.js";

export const magicItemsRendererRegistry = {
  "magic-items.summary.table": tableRenderer,
  "magic-items.entity.card":   cardRenderer,
};
