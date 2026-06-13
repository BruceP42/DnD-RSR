/* ---------------------------------------------------------
Path: pipeline/verify/verify-magic-items.js
File: verify-magic-items.js
Version: V1.1
Data Schema: V1.1
System: D&D Reference System – Data Pipeline V3.0
Module/Role: Domain verifier for magic items dataset; validates aggregated magic item records
Dependencies:
  - ./_core/verification-engine.js
Created: 2026-03-10
Last Updated: 2026-05-17
Author: Bruce Pilcher
Changelog:
  V1.1: Replaced console.log calls with logInfo (logging utility). Replaced verifyStringArray on item_desc with local verifyItemDesc. item_desc now contains typed objects ({ type, headers, rows } or { type, text }) after normalize-magic-items V1.4 — a string-only check would fail on every record. verifyItemDesc accepts strings and typed objects with type "table" or "paragraph".
  V1.0: Refactored into reusable ES module for Pipeline V3
Related Files:
  normalize-magic-items.js
  aggregate-magic-items.js
  verify-spells.js
  verify-monsters.js
--------------------------------------------------------- */

import * as verificationEngine from "../_core/verification-engine.js";
import { logInfo }             from "../utils/logging.js";

const REQUIRED_FIELDS = [
  "id","name","magic_item_category","rarity","attunement","item_desc",
  "sources","data_file_provenance"
];

function verifyItemDesc(itemDesc) {
  if (!Array.isArray(itemDesc) || itemDesc.length === 0) {
    throw new Error(`"item_desc" must be a non-empty array`);
  }
  itemDesc.forEach((el, i) => {
    if (typeof el === "string") return;
    if (el !== null && typeof el === "object" &&
        (el.type === "table" || el.type === "paragraph")) return;
    throw new Error(
      `item_desc[${i}] must be a string or a typed object ` +
      `with type "table" or "paragraph"`
    );
  });
}

function verifyMagicItem(item) {

  const canonicalItem =
    verificationEngine.canonicalizeRecordForOrdering(item, ["name","id"]);

  verificationEngine.verifyNoNulls(canonicalItem);
  verificationEngine.verifySources(canonicalItem.sources);
  verificationEngine.verifyIdFormat(canonicalItem.id);
  verificationEngine.verifyRequiredFields(canonicalItem, REQUIRED_FIELDS);
  verifyItemDesc(canonicalItem.item_desc);

  verificationEngine.verifyAttunementLogic(
    canonicalItem.attunement,
    canonicalItem.attunement_restrictions
  );
}

export function verifyMagicItems(dataset) {

  logInfo(`Verifying magic items dataset... Records: ${dataset.length}`, "verification");

  dataset.forEach((item, index) => {
    try {
      verifyMagicItem(item);
    }
    catch (error) {
      throw new Error(
        `Magic item verification failed (index ${index}, id=${dataset[index].id}): ${error.message}`
      );
    }
  });

  logInfo("All magic items passed verification.", "verification");
}