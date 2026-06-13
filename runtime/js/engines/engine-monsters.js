/* ---------------------------------------------------------
Path: runtime/js/engines/
File: engine-monsters.js
Version: V1.0
Data Schema: V1.1
System: D&D Reference System – Reference Engine (Query Layer)
Module/Role: Monsters domain engine; thin wrapper around createEngine
  that initialises and returns a query engine for the monsters dataset

Dependencies:
  - runtime/js/engines/_core/engine-factory.js
  - runtime/data/monsters.js

Created: 2026-04-08
Last Updated: 2026-04-08
Author: Bruce Pilcher
Reviewed By:
Changelog:
  V1.0: Initial implementation; mirrors engine-spells.js pattern
Related Files:
  runtime/js/engines/_core/engine-factory.js
  runtime/js/engines/_core/engine-composite.js
  runtime/js/registry/datasets.js
  runtime/js/registry/dataset-registry.js
  runtime/js/controllers/monsters-controller.js
Notes:
  - Pure data-layer module: no DOM, no rendering responsibilities
  - Delegates all query logic to createEngine
  - No domain-specific query logic lives here — engine-factory
    handles filtering, sorting, pagination, and composite resolution
  - sources injected as null until composite resolution is needed
    for monsters; extend when source expansion is required
--------------------------------------------------------- */

import { createEngine } from "./_core/engine-factory.js";
import monstersData     from "../../data/monsters.js";

export const engineMonsters = createEngine({
  data:    monstersData,
  indexes: null,
  sources: null
});