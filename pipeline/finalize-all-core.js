/* ---------------------------------------------------------
Path: pipeline/finalize-all-core.js
File: finalize-all-core.js
Version: V1.1
Data Schema: V1.1
System: D&D Reference System – Data Pipeline V3.0
Module/Role: Finalization stage — reads aggregated datasets and writes
  one canonical dataset file per domain to runtime/data/ for
  consumption by the RSR. Deletes pipeline-needed.flag on success.
Dependencies:
  - pipeline/utils/logging.js
Created: 2026-04-09
Last Updated: 2026-06-07
Author: Bruce Pilcher
Changelog:
  V1.1: Delete pipeline-needed.flag after all domains finalize
        successfully. Non-fatal if the flag is absent — this is the
        normal state when the pipeline is run without any prior UI
        edits. Logs outcome either way.
  V1.0: Initial implementation.
Used by: build-all.js
Notes:
  - This is the final pipeline stage. Its output is the authoritative
    runtime artifact for each domain.
  - Output format: export default [...];
  - Output naming: <domain>-dataset.js
  - Output location: runtime/data/
  - Sources is written first as all other domains depend on it.
  - The runtime/data/ directory is created automatically if absent.
  - pipeline-needed.flag lives at project root (one level above pipeline/).
--------------------------------------------------------- */

import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { logInfo, logError } from "./utils/logging.js";

// Convert ES module URL → directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// Input: aggregated datasets produced by the aggregation stage
const AGGREGATED_DIR = path.join(__dirname, "./data/aggregated");

// Output: runtime/data/ — consumed by the RSR
const RUNTIME_DATA_DIR = path.join(__dirname, "../runtime/data");

// Flag: project root — one level above pipeline/
const FLAG_PATH = path.join(__dirname, "../pipeline-needed.flag");

// Domain configuration — ORDER IS SIGNIFICANT.
// Sources must remain first; all other domains reference source IDs.
const DOMAIN_CONFIG = [
    { domain: "sources",     inFile: "sources.aggregated.js",     outFile: "sources-dataset.js"     },
    { domain: "spells",      inFile: "spells.aggregated.js",      outFile: "spells-dataset.js"      },
    { domain: "monsters",    inFile: "monsters.aggregated.js",    outFile: "monsters-dataset.js"    },
    { domain: "magic-items", inFile: "magic-items.aggregated.js", outFile: "magic-items-dataset.js" }
];

export async function finalizeAllCore() {
    // Ensure runtime/data/ exists — create it if absent
    if (!fs.existsSync(RUNTIME_DATA_DIR)) {
        fs.mkdirSync(RUNTIME_DATA_DIR, { recursive: true });
        logInfo(`Created output directory: ${RUNTIME_DATA_DIR}`);
    }

    for (const { domain, inFile, outFile } of DOMAIN_CONFIG) {
        const inPath = path.join(AGGREGATED_DIR, inFile);

        if (!fs.existsSync(inPath)) {
            logError(`Aggregated file not found for domain "${domain}": ${inPath}`);
            throw new Error(`Missing aggregated file for domain "${domain}": ${inFile}`);
        }

        const module  = await import(pathToFileURL(inPath).href);
        const records = module.default ?? module;

        if (!Array.isArray(records)) {
            logError(`Aggregated data for domain "${domain}" is not an array`);
            throw new Error(`Invalid aggregated data for domain "${domain}": expected array`);
        }

        const outPath = path.join(RUNTIME_DATA_DIR, outFile);
        const content = `export default ${JSON.stringify(records, null, 2)};\n`;
        fs.writeFileSync(outPath, content, "utf-8");

        logInfo(`Finalized ${records.length} ${domain} records → ${outFile}`);
    }

    // Delete pipeline-needed.flag if present.
    // Non-fatal if absent — the normal state when the pipeline is run
    // without any prior UI edits since the last successful run.
    try {
        if (fs.existsSync(FLAG_PATH)) {
            fs.unlinkSync(FLAG_PATH);
            logInfo("pipeline-needed.flag deleted ✅");
        } else {
            logInfo("pipeline-needed.flag not present — nothing to delete");
        }
    } catch (err) {
        logError(`Could not delete pipeline-needed.flag: ${err.message}`);
        // Non-fatal — pipeline output is complete; log and continue.
    }
}
