/* ---------------------------------------------------------
Path: pipeline/aggregate-all-core.js
File: aggregate-all-core.js
Version: V1.2
Data Schema: V1.1
System: D&D Reference System – Data Pipeline V3.0
Module/Role: Core logic for aggregating all domains
Dependencies:
  - pipeline/aggregate/aggregate-sources.js
  - pipeline/aggregate/aggregate-spells.js
  - pipeline/aggregate/aggregate-monsters.js
  - pipeline/aggregate/aggregate-magic-items.js
Created: 2026-03-14
Last Updated: 2026-04-09
Author: Bruce Pilcher
Changelog:
  V1.0: Initial implementation
  V1.1: Added sources domain — sources must be aggregated first as all
        other domains depend on it. Converted DOMAIN_CONFIG from object
        to array to make ordering guarantee explicit. Added precedence
        label mapping fix (was incorrectly passing raw filenames to
        aggregators instead of category labels).
  V1.2: Switched to f.startsWith(prefix) for unambiguous file matching.
        Sources raw file renamed from source-books.js to sources-SRD.js
        to align with the naming convention used by all other domains.
Used by: build-all.js
--------------------------------------------------------- */

import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

import { aggregateSources    } from "./aggregate/aggregate-sources.js";
import { aggregateSpells     } from "./aggregate/aggregate-spells.js";
import { aggregateMonsters   } from "./aggregate/aggregate-monsters.js";
import { aggregateMagicItems } from "./aggregate/aggregate-magic-items.js";

// Convert ES module URL → directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// Normalized and aggregated data directories
const NORMALIZED_DIR = path.join(__dirname, "./data/normalized");
const AGGREGATED_DIR = path.join(__dirname, "./data/aggregated");

// Domain configuration — ORDER IS SIGNIFICANT.
// Sources must remain first; all other domains reference source IDs.
const DOMAIN_CONFIG = [
    {
        domain:     "sources",
        prefix:     "sources",
        aggregator: aggregateSources,
        outFile:    "sources.aggregated.js"
    },
    {
        domain:     "spells",
        prefix:     "spells",
        aggregator: aggregateSpells,
        outFile:    "spells.aggregated.js"
    },
    {
        domain:     "monsters",
        prefix:     "monsters",
        aggregator: aggregateMonsters,
        outFile:    "monsters.aggregated.js"
    },
    {
        domain:     "magic-items",
        prefix:     "magic-items",
        aggregator: aggregateMagicItems,
        outFile:    "magic-items.aggregated.js"
    }
];

export async function aggregateAllCore() {
    for (const { domain, prefix, aggregator, outFile } of DOMAIN_CONFIG) {
        const allFiles = fs.readdirSync(NORMALIZED_DIR)
            .filter(f =>
                f.startsWith(prefix) &&
                f.endsWith(".normalized.js")
            );

        if (allFiles.length === 0) continue;

        const datasets = [];
        for (const file of allFiles) {
            const datasetPath = path.join(NORMALIZED_DIR, file);
            const module = await import(pathToFileURL(datasetPath).href);
            datasets.push(module.default ?? module);
        }

        // Map filenames to precedence category labels.
        // The aggregation engine expects these labels, not raw filenames.
        const precedenceLabels = allFiles.map(f => {
            if (f.includes('-SRD'))    return 'SRD';
            if (f.includes('-custom')) return 'Custom';
            return 'Third-Party';
        });

        const aggregated = aggregator(datasets, precedenceLabels);

        const outPath = path.join(AGGREGATED_DIR, outFile);
        fs.writeFileSync(outPath, `export default ${JSON.stringify(aggregated, null, 2)};\n`);
    }
}