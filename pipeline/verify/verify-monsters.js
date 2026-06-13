/* ---------------------------------------------------------
Path: pipeline/verify/verify-monsters.js
File: verify-monsters.js
Version: V1.1
Data Schema: V1.1
System: D&D Reference System – Data Pipeline V3.0
Module/Role: Domain verifier for monsters dataset; validates aggregated monster records against Schema V1.1
Dependencies:
  - ./_core/verification-engine.js
Created: 2026-03-10
Last Updated: 2026-05-17
Author: Bruce Pilcher
Changelog:
  V1.1: Replaced direct console.log calls with logInfo from logging utility.
  V1.0: Refactored into reusable ES module for Pipeline V3
Related Files:
  normalize-monsters.js
  aggregate-monsters.js
  verify-spells.js
  verify-magic-items.js
--------------------------------------------------------- */

import * as verificationEngine from "../_core/verification-engine.js";
import { logInfo }             from "../utils/logging.js";

const REQUIRED_FIELDS = [
  "id",
  "name",
  "creature_type",
  "alignment",
  "ac",
  "hp",
  "speed",
  "ability_scores",
  "cr",
  "xp",
  "sources",
  "data_file_provenance"
];

function verifyMonster(monster) {

  const canonicalMonster =
    verificationEngine.canonicalizeRecordForOrdering(monster, ["name","id"]);

  verificationEngine.verifyNoNulls(canonicalMonster);
  verificationEngine.verifySources(canonicalMonster.sources);
  verificationEngine.verifyIdFormat(canonicalMonster.id);
  verificationEngine.verifyRequiredFields(canonicalMonster, REQUIRED_FIELDS);

  verificationEngine.verifyAbilityScores(canonicalMonster.ability_scores);

  verificationEngine.verifyCrXpRule(canonicalMonster);

  if (canonicalMonster.cr !== undefined) {
    verificationEngine.verifyCR(canonicalMonster.cr);
  }
}

export function verifyMonsters(dataset) {

  logInfo(`Verifying monsters dataset... Records: ${dataset.length}`, "verification");

  dataset.forEach((monster, index) => {
    try {
      verifyMonster(monster);
    }
    catch (error) {
      throw new Error(
        `Monster verification failed (index ${index}, id=${dataset[index].id}): ${error.message}`
      );
    }
  });

  logInfo("All monsters passed verification.", "verification");
}