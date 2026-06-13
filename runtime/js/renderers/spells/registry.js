/* ---------------------------------------------------------
Path: runtime/js/renderers/spells/registry.js
File: registry.js
Version: V1.0
Data Schema: V1.1
System: D&D Reference System – Reference System Runtime (RSR)
Module/Role: Domain renderer registry for spells; maps
  (domain.viewType.renderMode) keys to concrete renderer
  implementations for the spells domain

Dependencies:
  - runtime/js/renderers/table-renderer.js
  - runtime/js/renderers/card-renderer.js

Created: 2026-04-05
Last Updated: 2026-04-05
Author: Bruce Pilcher
Reviewed By:
Changelog:
  V1.0: Initial spells renderer registry; mirrors template and
    validator registry key structure
Related Files:
  runtime/js/resolve-renderer.js
  runtime/js/renderers/table-renderer.js
  runtime/js/renderers/card-renderer.js
  runtime/js/templates/spells/registry.js
  runtime/js/validators/spells/registry.js
Notes:
  - Keys MUST follow format: domain.viewType.renderMode
  - MUST stay in sync with spells template registry and
    spells validator registry
  - Add a key here whenever a new viewType/renderMode is added
    for the spells domain
--------------------------------------------------------- */

import { tableRenderer } from "../table-renderer.js";
import { cardRenderer } from "../card-renderer.js";

export const spellsRendererRegistry = {
  "spells.summary.table": tableRenderer,
  "spells.summary.card":  cardRenderer,
  "spells.entity.card":   cardRenderer
};