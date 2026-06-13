/* ---------------------------------------------------------
Path: pipeline/verify/verify-spells.js
File: verify-spells.js
Version: V1.1
Data Schema: V1.1
System: D&D Reference System – Data Pipeline V3.0
Module/Role: Domain verifier for spells dataset; validates aggregated spell records against Schema V1.1
Dependencies:
  - ./_core/verification-engine.js
Created: 2026-03-10
17Last Updated: 2026-05
Author: Bruce Pilcher
Changelog:
  V1.1: Replaced direct console.log calls with logInfo from logging utility.
  V1.0: Refactored into reusable ES module for Pipeline V3
Related Files:
  normalize-spells.js
  aggregate-spells.js
  verify-monsters.js
--------------------------------------------------------- */

import * as verificationEngine from "../_core/verification-engine.js";
import { logInfo }             from "../utils/logging.js";

const REQUIRED_FIELDS = [
  "id","name","level","school","casting_time","range",
  "components","duration","concentration","ritual",
  "spell_desc","classes","sources","data_file_provenance"
];

function verifySpell(spell) {

  const canonicalSpell =
    verificationEngine.canonicalizeRecordForOrdering(spell, ["name","id"]);

  verificationEngine.verifyNoNulls(canonicalSpell);
  verificationEngine.verifySources(canonicalSpell.sources);
  verificationEngine.verifyIdFormat(canonicalSpell.id);
  verificationEngine.verifyRequiredFields(canonicalSpell, REQUIRED_FIELDS);
  verificationEngine.verifySpellLevel(canonicalSpell.level);
  verificationEngine.verifyNonEmptyArray(canonicalSpell.components, "components");
  verificationEngine.verifyStringArray(canonicalSpell.spell_desc, "spell_desc");
  verificationEngine.verifyNonEmptyArray(canonicalSpell.classes, "classes");
  verificationEngine.verifyBooleanField(canonicalSpell.concentration, "concentration");
  verificationEngine.verifyBooleanField(canonicalSpell.ritual, "ritual");
  verificationEngine.verifyMaterialComponent(
    canonicalSpell.components,
    canonicalSpell.material
  );
}

export function verifySpells(dataset) {

  logInfo(`Verifying spells dataset... Records: ${dataset.length}`, "verification");

  dataset.forEach((spell, index) => {
    try {
      verifySpell(spell);
    }
    catch (error) {
      throw new Error(
        `Spell verification failed (index ${index}, id=${dataset[index].id}): ${error.message}`
      );
    }
  });

  logInfo("All spells passed verification.", "verification");
}