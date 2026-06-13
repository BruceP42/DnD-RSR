/* ---------------------------------------------------------
Path: pipeline/build-all.js
File: build-all.js
Version: V3.2
Data Schema: V1.1
System: D&D Reference System – Data Pipeline V3.0
Module/Role: Full pipeline orchestrator
Dependencies:
  - pipeline/utils/logging.js
  - pipeline/utils/stage-runner.js
  - pipeline/normalize-all-core.js
  - pipeline/verify-all-core.js
  - pipeline/aggregate-all-core.js
  - pipeline/finalize-all-core.js
Created: 2026-03-14
Last Updated: 2026-04-09
Author: Bruce Pilcher
Changelog:
  V3.1: Refactored to use stage-runner.js. Removed duplicate timing
        logic. Clean orchestration of normalization → verification →
        aggregation. Fully aligned with pipeline V3 logging utilities.
  V3.2: Added Finalization stage. Pipeline now writes one canonical
        <domain>-dataset.js per domain to runtime/data/ as its final
        act. Stage order: Normalization → Verification → Aggregation
        → Finalization.
Notes:
  - This script runs the complete data pipeline.
  - Stages execute sequentially to maintain deterministic output.
  - Individual stage scripts (normalize-all.js, verify-all.js,
    aggregate-all.js) can still be executed independently for debugging.
  - Finalization is the only stage that writes outside pipeline/.
    It writes to runtime/data/ which is consumed by the RSR.
--------------------------------------------------------- */

import { runStage } from "./utils/stage-runner.js";
import { logInfo, logError } from "./utils/logging.js";

import { normalizeAllCore } from "./normalize-all-core.js";
import { verifyAllCore    } from "./verify-all-core.js";
import { aggregateAllCore } from "./aggregate-all-core.js";
import { finalizeAllCore  } from "./finalize-all-core.js";

async function buildAll() {
    logInfo("Starting full pipeline build", "build");

    try {
        await runStage("Normalization", async () => {
            await normalizeAllCore();
        });

        await runStage("Verification", async () => {
            await verifyAllCore();
        });

        await runStage("Aggregation", async () => {
            await aggregateAllCore();
        });

        await runStage("Finalization", async () => {
            await finalizeAllCore();
        });

        logInfo("Pipeline build completed successfully", "build");

    } catch (error) {
        logError(`Pipeline build failed → ${error.message}`, "build");
        process.exit(1);
    }
}

buildAll();