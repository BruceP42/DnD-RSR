/* ---------------------------------------------------------
Path: runtime/js/validation/spells/registry.js
File: registry.js
Version: V1.0
Data Schema: V1.1
System: D&D Reference System – Reference System Runtime (RSR)
Module/Role: Domain validation registry for spells; defines valid
  (domain.viewType.renderMode) combinations for the spells domain

Dependencies: None

Created: 2026-04-05
Last Updated: 2026-04-05
Author: Bruce Pilcher
Reviewed By:
Changelog:
  V1.0: Initial spells validation registry; mirrors template registry
    key structure
Related Files:
  runtime/js/validation/validation.js
  runtime/js/templates/spells/registry.js
Notes:
  - Keys MUST follow format: domain.viewType.renderMode
  - MUST stay in sync with spells template registry
  - Add a key here whenever a new viewType/renderMode is added
    to the spells template registry
--------------------------------------------------------- */

export const spellsValidation = {
  "spells.summary.table": true,
  "spells.summary.card":  true,
  "spells.entity.card":   true
};