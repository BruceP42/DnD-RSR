/* ---------------------------------------------------------
   Path:         runtime/js/registry/datasets.js
   File:         datasets.js
   Version:      V1.4
   Data Schema:  V1.1
   System:       DnD-RSR — D&D 5e Dynamic Reference System
   Module/Role:  System dataset registry configuration.
                 Maps each domain to its dataset file.
   Dependencies: none
   Created:      2026-03-23
   Last Updated: 2026-05-24
   Author:       Bruce Pilcher
   Changelog:
     V1.4: Adapted for DnD-RSR public repository.
           System name updated. Paths unchanged — ../../data/
           from runtime/js/registry/ correctly resolves to
           runtime/data/ in both the personal site and
           DnD-RSR (directory structure is identical).
     V1.3: All domains now point to canonical <domain>-dataset.js
           files in runtime/data/ produced by the pipeline
           finalization stage. Added magic-items domain.
           Removed transitional comments. Removed provenance
           field. Sources listed first — required by all other
           domains.
     V1.2: Converted var to export const (ESM compliance).
           Switched to transitional normalized paths.
           Removed monsters and magicItems until datasets exist.
     V1.1: Added sources domain.
     V1.0: Initial configuration.
   Notes:
     - All source paths resolve relative to this file's location:
       runtime/js/registry/datasets.js
     - Two levels up (../../) lands in runtime/data/
     - Each domain has exactly one dataset — the pipeline merges
       all sources into a single canonical file per domain
     - writable: false marks system datasets as read-only.
       The add/edit workflow checks this before write operations.
     - priority: 100 is the baseline for system datasets.
       User datasets added by the add/edit workflow use
       priority: 200 so they override system records with the
       same ID.
     - The sources domain MUST remain first — dataset-registry.js
       loads it before all other domains.
--------------------------------------------------------- */

export const systemDatasets = {
  sources: {
    datasets: [
      {
        id:       "system",
        source:   "../../data/sources-dataset.js",
        enabled:  true,
        writable: false,
        priority: 100
      }
    ]
  },
  spells: {
    datasets: [
      {
        id:       "system",
        source:   "../../data/spells-dataset.js",
        enabled:  true,
        writable: false,
        priority: 100
      }
    ]
  },
  monsters: {
    datasets: [
      {
        id:       "system",
        source:   "../../data/monsters-dataset.js",
        enabled:  true,
        writable: false,
        priority: 100
      }
    ]
  },
  "magic-items": {
    datasets: [
      {
        id:       "system",
        source:   "../../data/magic-items-dataset.js",
        enabled:  true,
        writable: false,
        priority: 100
      }
    ]
  }
};
