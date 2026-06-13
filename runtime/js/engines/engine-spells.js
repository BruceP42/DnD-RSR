/* ---------------------------------------------------------
Path: runtime/js/engines/engine-spells.js
File: engine-spells.js
Version: V1.0
Data Schema: V1.1
System: D&D Reference System – Reference Engine (Query Layer)
Module/Role: Spells domain engine; thin wrapper around createEngine
  that initialises and returns a query engine for the spells dataset
Dependencies:
  - runtime/js/engines/_core/engine-factory.js
  - runtime/data/spells-dataset.js
Created: 2026-04-12
Last Updated: 2026-04-12
Author: Bruce Pilcher
Changelog:
  V1.0: Initial implementation; mirrors engine-monsters.js pattern
Related Files:
  - runtime/js/engines/_core/engine-factory.js
  - runtime/js/engines/_core/engine-composite.js
  - runtime/js/registry/datasets.js
  - runtime/js/registry/dataset-registry.js
  - runtime/js/controllers/spells-controller.js
Notes:
  - Pure data-layer module: no DOM, no rendering responsibilities
  - Delegates all query logic to createEngine
  - No domain-specific query logic lives here — engine-factory
    handles filtering, sorting, pagination, and composite resolution
  - sources injected as null until composite resolution is needed;
    extend when source expansion is required
--------------------------------------------------------- */

import { createEngine } from "./_core/engine-factory.js";
import spellsData       from "../../data/spells-dataset.js";

export const engineSpells = createEngine({
  data:    spellsData,
  indexes: null,
  sources: null
});
