/* ---------------------------------------------------------
Path: pipeline/utils/logging.js
File: logging.js
Version: V1.3
Data Schema: V1.1
System: D&D Reference System – Data Pipeline V3.0
Module/Role: Core logging utilities used across normalization, verification, aggregation, and build orchestration
Dependencies:
  - None
Created: 2026-03-11
Last Updated: 2026-03-13
Author: Bruce Pilcher
Changelog:
  V1.0: Initial canonical logging utility implementation supporting info, warning, and error logging for the pipeline
  V1.1: Added context-aware logging to identify pipeline subsystem (normalization, verification, aggregation, build)
  V1.2: Added timing instrumentation and build run ID for improved observability
  V1.3: Refactored prefix generation, centralized run ID, and timing utilities for cleaner, consistent, and context-aware logging
Related Files:
  pipeline/_core/normalization-engine.js
  pipeline/_core/verification-engine.js
  pipeline/_core/aggregation-engine.js
  pipeline/build-all.js
Notes:
  - Provides standardized logging output across the entire pipeline.
  - Logging format intentionally simple for readability in PowerShell / terminal.
  - Supports context-aware logging to identify the subsystem producing output.
  - Includes lightweight timing utilities for measuring pipeline phase duration.
  - Each pipeline run is tagged with a build run ID to assist with debugging repeated runs.
  - All pipeline logging should go through these functions rather than direct console calls.
--------------------------------------------------------- */

/* =========================================================
   PIPELINE RUN IDENTIFIER
   ---------------------------------------------------------
   Each execution of the pipeline receives a unique run ID.
   This helps differentiate logs when multiple builds occur
   during development or debugging sessions.
========================================================= */
export const BUILD_RUN_ID = new Date().toISOString().replace(/[:.]/g, "-");

/* =========================================================
   LOG PREFIX GENERATION
   ---------------------------------------------------------
   Produces a standardized prefix for all log entries.
   Example outputs:
   [pipeline][run:2026-03-13T18-45-20][aggregation]
   [pipeline][run:2026-03-13T18-45-20]
========================================================= */
const LOG_PREFIX = "[pipeline]";
function formatPrefix(context) {
    const runTag = `[run:${BUILD_RUN_ID}]`;
    if (context) {
        return `${LOG_PREFIX}${runTag}[${context}]`;
    }
    return `${LOG_PREFIX}${runTag}`;
}

/* =========================================================
   INFO LOGGING
========================================================= */
export function logInfo(message, context = null) {
    console.log(`${formatPrefix(context)} INFO: ${message}`);
}

/* =========================================================
   WARNING LOGGING
========================================================= */
export function logWarning(message, context = null) {
    console.warn(`${formatPrefix(context)} WARNING: ${message}`);
}

/* =========================================================
   ERROR LOGGING
========================================================= */
export function logError(message, context = null) {
    console.error(`${formatPrefix(context)} ERROR: ${message}`);
}

/* =========================================================
   DEBUG LOGGING
   ---------------------------------------------------------
   Used for verbose development diagnostics.
   Not normally required during standard pipeline runs.
========================================================= */
export function logDebug(message, context = null) {
    console.debug(`${formatPrefix(context)} DEBUG: ${message}`);
}

/* =========================================================
   TIMING UTILITIES
   ---------------------------------------------------------
   Lightweight performance instrumentation used to measure
   how long specific pipeline phases take.
   Example usage:
   startTimer("Spell normalization");
   ...perform work...
   endTimer("Spell normalization", "normalization");
========================================================= */
const timers = new Map();

export function startTimer(label) {
    timers.set(label, performance.now());
}

export function endTimer(label, context = null) {
    const start = timers.get(label);
    if (!start) {
        logWarning(`Timer "${label}" was never started`, context);
        return;
    }
    const duration = performance.now() - start;
    timers.delete(label);
    logInfo(`${label} completed in ${duration.toFixed(2)} ms`, context);
}

/* =========================================================
   Recommendations for Further Improvements
   ---------------------------------------------------------
   - Add configurable log levels (INFO, WARN, ERROR, DEBUG)
     to allow runtime filtering.
   - Optionally allow logging to file or external monitoring
     service for persistent build records.
   - Include async-safe timers for I/O heavy operations.
========================================================= */