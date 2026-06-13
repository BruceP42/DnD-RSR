/* ---------------------------------------------------------
Path: runtime/js/templates/spells/registry.js
File: registry.js
Version: V1.0
Data Schema: V1.1
System: D&D Reference System – Reference System Runtime (RSR)
Module / Role: Domain template registry for spells; maps (domain.viewType.renderMode) keys to concrete template implementations

Dependencies:
  - runtime/js/templates/spells/summary/table.js
  - runtime/js/templates/spells/entity/card.js

Created: 2026-03-24
Last Updated: 2026-04-01
Author: Bruce Pilcher
Reviewed By:

Changelog:
  V1.0: Initial spell template registry defining summary.table and entity.card template mappings

Related Files:
  runtime/js/templates/resolve-template.js
  runtime/js/render-dispatcher.js
  runtime/js/templates/spells/summary/table.js
  runtime/js/templates/spells/entity/card.js

Notes:
  - This registry is consumed by resolve-template.js during runtime aggregation
  - Keys MUST follow format: domain.viewType.renderMode
  - Acts as the authoritative mapping layer for spell template resolution
  - Additional spell view types and render modes must be registered here before runtime use
--------------------------------------------------------- */
import { tableTemplate as spellsSummaryTable } 
  from "./summary/table.js";

import { spellEntityCardTemplate } 
  from "./entity/card.js";

export const spellsRegistry = {
  "spells.summary.table": spellsSummaryTable,
  "spells.entity.card": spellEntityCardTemplate
};