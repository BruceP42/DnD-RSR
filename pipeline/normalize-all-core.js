/* ---------------------------------------------------------
Path: pipeline/normalize-all-core.js
File: normalize-all-core.js
Version: V1.2
Data Schema: V1.1
System: D&D Reference System – Data Pipeline V3.0
Module/Role: Core logic for normalizing all domains
Dependencies:
  - pipeline/normalize/normalize-sources.js
  - pipeline/normalize/normalize-spells.js
  - pipeline/normalize/normalize-monsters.js
  - pipeline/normalize/normalize-magic-items.js
Created: 2026-03-14
Last Updated: 2026-04-09
Author: Bruce Pilcher
Changelog:
  V1.0: Initial implementation
  V1.1: Added sources domain — sources must be normalized first as all
        other domains depend on it. Converted DOMAIN_CONFIG from object
        to array to make ordering guarantee explicit.
  V1.2: Switched to f.startsWith(prefix) for unambiguous file matching.
        Sources raw file renamed from source-books.js to sources-SRD.js
        to align with the naming convention used by all other domains.
Used by: build-all.js
--------------------------------------------------------- */

import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

import { normalizeSources    } from "./normalize/normalize-sources.js";
import { normalizeSpells     } from "./normalize/normalize-spells.js";
import { normalizeMonsters   } from "./normalize/normalize-monsters.js";
import { normalizeMagicItems } from "./normalize/normalize-magic-items.js";

// Convert ES module URL → directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// Raw data directory
const RAW_DIR = path.join(__dirname, "./data/raw");

// Domain configuration — ORDER IS SIGNIFICANT.
// Sources must remain first; all other domains reference source IDs.
const DOMAIN_CONFIG = [
    { domain: "sources",     prefix: "sources",     normalizer: normalizeSources    },
    { domain: "spells",      prefix: "spells",      normalizer: normalizeSpells     },
    { domain: "monsters",    prefix: "monsters",    normalizer: normalizeMonsters   },
    { domain: "magic-items", prefix: "magic-items", normalizer: normalizeMagicItems }
];

export async function normalizeAllCore() {
    let totalRecords = 0;
    let datasetCount = 0;

    for (const { domain, prefix, normalizer } of DOMAIN_CONFIG) {
        const files = fs.readdirSync(RAW_DIR)
            .filter(file =>
                file.startsWith(prefix) &&
                file.endsWith(".js")
            );

        if (files.length === 0) continue;

        for (const file of files) {
            const filePath    = path.join(RAW_DIR, file);
            const datasetName = file.replace(".js", "");

            const module     = await import(pathToFileURL(filePath).href);
            const rawDataset = module.default ?? module;

            await normalizer(rawDataset, datasetName, true);

            totalRecords += rawDataset.length;
            datasetCount++;
        }
    }

    return { totalRecords, datasetCount };
}