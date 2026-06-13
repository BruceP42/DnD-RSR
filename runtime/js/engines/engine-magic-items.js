/* ---------------------------------------------------------
Path: runtime/js/engines/engine-magic-items.js
File: engine-magic-items.js
Version: V2.0
Data Schema: V1.1
System: D&D Reference System – Reference Engine (Query Layer)
Module/Role: Magic items domain engine; thin wrapper around
  createEngine that initialises and returns a query engine for
  the magic items dataset. Supplies a rarity comparator so
  that sorting by rarity uses canonical D&D 5e order rather
  than alphabetical order.
Dependencies:
  - runtime/js/engines/_core/engine-factory.js
  - runtime/data/magic-items-dataset.js
Created: 2026-04-12
Last Updated: 2026-06-05
Author: Bruce Pilcher
Changelog:
  V2.0:
    - Added RARITY_ORDER rank map and rarityComparator
    - Passes comparators: { rarity } to createEngine
    - Unknown rarity values receive rank -1 (sort to start)
  V1.0:
    - Initial implementation; mirrors engine-monsters.js pattern
Related Files:
  - runtime/js/engines/_core/engine-factory.js
  - runtime/js/engines/_core/engine-composite.js
  - runtime/js/registry/datasets.js
  - runtime/js/registry/dataset-registry.js
  - runtime/js/controllers/magic-items-controller.js
Notes:
  - Pure data-layer module: no DOM, no rendering responsibilities
  - Delegates all query logic to createEngine
  - sources injected as null until composite resolution is needed;
    extend when source expansion is required

  Adding a domain-specific sort comparator (worked example)
  ----------------------------------------------------------
  Problem: rarity values are strings ("Common", "Rare", etc.).
  Generic < / > comparison sorts them alphabetically, which
  does not match canonical D&D 5e rarity order.

  Solution:
    1. Define a rank map — an object keyed by the exact
       lowercase field values found in the dataset, with
       numeric ranks representing the desired sort order.

       const RARITY_ORDER = {
         "varies":    0,
         "common":    1,
         "uncommon":  2,
         "rare":      3,
         "very rare": 4,
         "legendary": 5,
         "artifact":  6
       };

    2. Write a comparator function. Normalise the incoming
       value to lowercase, look it up in the rank map, and
       return -1 for any unrecognised value so unknowns
       sort to the start (project-wide convention).

       function rarityComparator(value) {
         const rank = RARITY_ORDER[(value ?? "").toLowerCase()];
         return rank !== undefined ? rank : -1;
       }

    3. Pass comparators to createEngine:

       createEngine({
         data:        magicItemsData,
         comparators: { rarity: rarityComparator }
       });

  To add a comparator for a new domain, follow the same
  three steps in that domain's engine file. No changes to
  engine-factory.js are required.
--------------------------------------------------------- */

import { createEngine }  from "./_core/engine-factory.js";
import magicItemsData    from "../../data/magic-items-dataset.js";

/* ---------------------------------------------------------
   Rarity rank map — canonical D&D 5e order (low → high).
   Keys are lowercase to match normalised runtime dataset values.
   Unknowns receive rank -1 in rarityComparator (sort to start).
--------------------------------------------------------- */
const RARITY_ORDER = {
  "varies":    0,
  "common":    1,
  "uncommon":  2,
  "rare":      3,
  "very rare": 4,
  "legendary": 5,
  "artifact":  6
};

function rarityComparator(value) {
  const rank = RARITY_ORDER[(value ?? "").toLowerCase()];
  return rank !== undefined ? rank : -1;
}

export const engineMagicItems = createEngine({
  data:        magicItemsData,
  indexes:     null,
  sources:     null,
  comparators: { rarity: rarityComparator }
});
