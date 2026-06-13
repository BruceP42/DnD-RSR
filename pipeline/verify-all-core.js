/* ---------------------------------------------------------
Path: pipeline/verify-all-core.js
File: verify-all-core.js
Version: V1.1
Data Schema: V1.1
System: D&D Reference System – Data Pipeline V3.0
Module/Role: Core logic for verifying all domains
Dependencies:
  - pipeline/verify/verify-spells.js
  - pipeline/verify/verify-monsters.js
  - pipeline/verify/verify-magic-items.js
Created: 2026-03-14
Last Updated: 2026-05-21
Author: Bruce Pilcher
Changelog:
  V1.0: Initial implementation — read aggregated files, call verifyBatch with empty rules.
  V1.1: Fixed silent-skip bug. Verification now reads from data/normalized/ (correct
        pre-aggregation stage) instead of data/aggregated/. Replaced verifyBatch with
        empty rules with direct calls to the three domain verifiers (verifySpells,
        verifyMonsters, verifyMagicItems), which contain all validation logic.
        File-scanning pattern now matches aggregate-all-core.js: prefix + .normalized.js.
        Records from all normalized files per domain are concatenated before verification.
--------------------------------------------------------- */

import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

import { verifySpells     } from "./verify/verify-spells.js";
import { verifyMonsters   } from "./verify/verify-monsters.js";
import { verifyMagicItems } from "./verify/verify-magic-items.js";

// Convert ES module URL → directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// Normalized data directory — verification runs before aggregation
const NORMALIZED_DIR = path.join(__dirname, "./data/normalized");

// Domain configuration — ORDER IS SIGNIFICANT.
// Sources are not verified here; no verify-sources domain verifier exists.
const DOMAIN_CONFIG = [
    { domain: "spells",      prefix: "spells",      verifier: verifySpells     },
    { domain: "monsters",    prefix: "monsters",    verifier: verifyMonsters   },
    { domain: "magic-items", prefix: "magic-items", verifier: verifyMagicItems }
];

export async function verifyAllCore() {
    for (const { prefix, verifier } of DOMAIN_CONFIG) {
        const files = fs.readdirSync(NORMALIZED_DIR)
            .filter(f =>
                f.startsWith(prefix) &&
                f.endsWith(".normalized.js")
            );

        if (files.length === 0) continue;

        const allRecords = [];
        for (const file of files) {
            const filePath = path.join(NORMALIZED_DIR, file);
            const module   = await import(pathToFileURL(filePath).href);
            const records  = module.default ?? module;
            allRecords.push(...records);
        }

        verifier(allRecords);
    }
}
