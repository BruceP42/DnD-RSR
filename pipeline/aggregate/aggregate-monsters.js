/* ---------------------------------------------------------
Path: pipeline/aggregate/aggregate-monsters.js
File: aggregate-monsters.js
Version: V1.1
Data Schema: V1.1
System: D&D Reference System – Data Pipeline V3.0
Module/Role: Domain aggregation for monsters
Dependencies:
  - pipeline/_core/aggregation-engine.js
  - pipeline/normalize/normalize-monsters.js
Created: 2026-03-10
Last Updated: 2026-03-10
Author: Bruce Pilcher
Notes:
  - Thin wrapper around aggregation-engine
  - Uses canonicalized name sorting and hardcoded dataset precedence
--------------------------------------------------------- */

import { aggregateBatch } from '../_core/aggregation-engine.js';

export function aggregateMonsters(normalizedDatasets, datasetNames, mergeFn = null) {
    return aggregateBatch(
        normalizedDatasets,
        datasetNames,
        'monsters',
        (a, b) => a.name.localeCompare(b.name),
        mergeFn
    );
}