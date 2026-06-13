/* ---------------------------------------------------------
Path: pipeline/utils/stage-runner.js
Purpose: Shared wrapper for <phase>-all.js scripts
Provides unified logging, timing, and error handling
--------------------------------------------------------- */

import { logInfo, logWarning, logError, startTimer, endTimer } from "./logging.js";

export async function runStage(stageName, stageFn) {
    logInfo(`Starting stage: ${stageName}`, stageName);
    startTimer(stageName);

    try {
        await stageFn();
        endTimer(stageName, stageName);
        logInfo(`Stage complete: ${stageName}`, stageName);
    } catch (err) {
        endTimer(stageName, stageName);
        logError(`Stage failed: ${stageName} → ${err.message}`, stageName);
        throw err;
    }
}