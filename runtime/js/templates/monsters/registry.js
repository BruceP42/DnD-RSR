/* ---------------------------------------------------------
Path:         runtime/js/templates/monsters/registry.js
File:         registry.js
Version:      V1.0
Data Schema:  V1.1
System:       D&D Reference System – Reference System Runtime (RSR)
Module/Role:  Monster template registry; maps compound (domain.viewType.renderMode) keys to concrete template objects.
              Consumed by resolve-template.js during runtime template resolution.
Dependencies:
  - runtime/js/templates/monsters/summary/table.js
  - runtime/js/templates/monsters/entity/card.js
  - runtime/js/templates/monsters/entity/stat-block.js
Created:      2026-04-08
Last Updated: 2026-04-30
Author:       Bruce Pilcher
Changelog:
  V1.0: Initial release with summary/table, entity/card, entity/stat-block
Related Files:
  runtime/js/resolve-template.js
  runtime/js/validators/monsters/registry.js
  runtime/js/renderers/monsters/registry.js
Notes:
  - Keys MUST follow format: domain.viewType.renderMode
  - Export name follows pattern: {domain}Registry
  - Keys must stay in sync with validators/monsters/registry.js and renderers/monsters/registry.js.
  - All three composite keys must be present or the validator will reject the combination before the template is ever resolved.
--------------------------------------------------------- */

import { monstersTableTemplate }      from "./summary/table.js";
import { monstersEntityCardTemplate } from "./entity/card.js";
import { monstersStatBlockTemplate }  from "./entity/stat-block.js";

export const monstersRegistry = {
  "monsters.summary.table":     monstersTableTemplate,
  "monsters.entity.card":       monstersEntityCardTemplate,
  "monsters.entity.stat-block": monstersStatBlockTemplate
};