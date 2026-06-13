/* ---------------------------------------------------------
Path: pipeline/aggregate/aggregate-sources.js
File: aggregate-sources.js
Version: V1.0
Data Schema: V1.1
System: D&D Reference System – Data Pipeline V3.0
Module/Role: Domain aggregation for sources
Dependencies:
  - pipeline/_core/aggregation-engine.js
Created: 2026-04-09
Last Updated: 2026-04-09
Author: Bruce Pilcher
Changelog:
  V1.0: Initial implementation
Notes:
  - Thin wrapper around aggregation-engine
  - Sources is a foundational domain — it should be aggregated
    before all other domains
  - Uses canonical id sorting and hardcoded dataset precedence
--------------------------------------------------------- */

import { aggregateBatch } from '../_core/aggregation-engine.js';

export function aggregateSources(normalizedDatasets, datasetNames, mergeFn = null) {
    return aggregateBatch(
        normalizedDatasets,
        datasetNames,
        'sources',
        (a, b) => a.id.localeCompare(b.id),
        mergeFn
    );
}