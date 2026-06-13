/* ---------------------------------------------------------
Path: runtime/js/templates/magic-items/registry.js
File: registry.js
Version: V1.1
Data Schema: V1.1
System: D&D Reference System – Reference System Runtime (RSR)
Module/Role: Magic-items template registry; maps compound
  (domain.viewType.renderMode) keys to concrete template
  objects. Consumed by resolve-template.js and filter-utils.js
  during runtime template resolution.
Dependencies:
  - runtime/js/templates/magic-items/summary/table.js
  - runtime/js/templates/magic-items/entity/card.js
Created: 2026-04-11
Last Updated: 2026-04-12
Author: Bruce Pilcher
Changelog:
  V1.1:
    - Renamed export from magicItemsTemplateRegistry to
      magicItemsRegistry for consistency with spellsRegistry
      and monstersRegistry naming pattern
    - Normalized file header to block delimiter style
  V1.0: Initial implementation
Related Files:
  runtime/js/resolve-template.js
  runtime/js/render-dispatcher.js
  runtime/js/templates/magic-items/summary/table.js
  runtime/js/templates/magic-items/entity/card.js
  runtime/js/_core/filter-utils.js
Notes:
  - Keys MUST follow format: domain.viewType.renderMode
  - Export name follows pattern: {domain}Registry (no "Template")
  - Acts as the authoritative mapping layer for magic-items
    template resolution
  - Additional view types and render modes must be registered
    here before runtime use
--------------------------------------------------------- */

import { tableTemplate } from "./summary/table.js";
import { cardTemplate }  from "./entity/card.js";

export const magicItemsRegistry = {
  "magic-items.summary.table": tableTemplate,
  "magic-items.entity.card":   cardTemplate
};
