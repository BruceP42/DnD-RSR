/* ---------------------------------------------------------
Path: pipeline/_core/verification-engine.js
File: verification-engine.js
Version: V1.3
Data Schema: V1.1
System: D&D Reference System – Data Pipeline V3.0
Module/Role: Core reusable verification utilities for domain verifiers
Dependencies:
  - pipeline/utils/logging.js
Created: 2026-03-10
Last Updated: 2026-03-10
Author: Bruce Pilcher
Changelog:
  V1.0: Initial implementation of reusable verification engine supporting Schema V1.1 validation rules.
  V1.1: Added verifyCR to validate canonical CR values for monsters.
  V1.2: Added canonicalization helpers for ordering-critical fields to support deterministic aggregation; reordered validations for safety.
  V1.3: Added verification orchestration (verifyBatch, verifyRecord) and structured verification logging.
Related Files:
  verify-spells.js
  verify-monsters.js
  verify-magic-items.js
Notes:
  - Includes canonicalization helpers for ordering-critical fields
  - Reusable validators for null safety, sources, CR, spell rules, monster rules, magic item rules
  - Ensures records are deterministic-ready before aggregation
--------------------------------------------------------- */
import { logInfo, logWarning } from "../utils/logging.js";
/* =========================================================
   CANONICALIZATION HELPERS
   ========================================================= */
function canonicalizeString(str) {
  return typeof str === "string" ? str.trim().toLowerCase() : str;
}
function canonicalizeRecordForOrdering(record, orderingFields = ["name", "id"]) {
  const canonicalized = { ...record };
  for (const field of orderingFields) {
    if (field in canonicalized && typeof canonicalized[field] === "string") {
      canonicalized[field] = canonicalizeString(canonicalized[field]);
    }
  }
  return canonicalized;
}
/* =========================================================
   VERIFICATION ORCHESTRATION
   ========================================================= */
function verifyRecord(record, rules, domain) {
  for (const rule of rules) {
    try {
      rule(record);
    } catch (err) {
      const id = record.id || "[no id]";
      logWarning(`[verify] ${domain} record ${id} failed ${rule.name}: ${err.message}`);
      throw err;
    }
  }
}
function verifyBatch(records, domain, rules) {
  logInfo(`Verifying ${records.length} ${domain} records`);
  let failures = 0;
  for (const record of records) {
    try {
      verifyRecord(record, rules, domain);
    } catch (err) {
      failures++;
      throw err; // fail fast — invalid data should stop the pipeline
    }
  }
  logInfo(`Verification complete for ${domain}`);
  logInfo(`Records checked: ${records.length}`);
  logInfo(`Failures: ${failures}`);
  return records;
}
/* =========================================================
   CORE VALIDATION FUNCTIONS
   ========================================================= */
function verifyRequiredFields(record, requiredFields) {
  for (const field of requiredFields) {
    if (!(field in record)) {
      throw new Error(`Missing required field: ${field}`);
    }
  }
}
function verifyNonEmptyArray(value, fieldName) {
  if (!Array.isArray(value)) throw new Error(`${fieldName} must be an array`);
  if (value.length === 0) throw new Error(`${fieldName} must contain at least one element`);
}
function verifyStringArray(value, fieldName) {
  if (!Array.isArray(value)) throw new Error(`${fieldName} must be an array`);
  for (const entry of value) {
    if (typeof entry !== "string") throw new Error(`${fieldName} must contain only strings`);
  }
}
function verifyNumberField(value, fieldName) {
  if (typeof value !== "number") throw new Error(`${fieldName} must be a number`);
}
function verifyBooleanField(value, fieldName) {
  if (typeof value !== "boolean") throw new Error(`${fieldName} must be a boolean`);
}
/* =========================================================
   SOURCE VALIDATION
   ========================================================= */
function verifySources(sources) {
  if (!Array.isArray(sources) || sources.length === 0)
    throw new Error(`sources must be a non-empty array`);
  for (const source of sources) {
    if (typeof source !== "object") throw new Error(`sources must contain objects`);
    if (!source.source) throw new Error(`source object missing 'source' field`);
    if (!source.page) throw new Error(`source object missing 'page' field`);
  }
}
/* =========================================================
   ID VALIDATION
   ========================================================= */
function verifyIdFormat(id) {
  const pattern = /^(sp|mo|mi)-[A-Za-z0-9]+-\d+$/;
  if (typeof id !== "string" || !pattern.test(id))
    throw new Error(`Invalid ID format: ${id}`);
}
/* =========================================================
   NULL SAFETY
   ========================================================= */
function verifyNoNulls(obj, path = "") {
  if (obj === null) throw new Error(`Null value found at ${path}`);
  if (Array.isArray(obj)) {
    obj.forEach((item, index) => verifyNoNulls(item, `${path}[${index}]`));
  }
  else if (typeof obj === "object") {
    for (const key in obj) {
      verifyNoNulls(obj[key], `${path}${key}.`);
    }
  }
}
/* =========================================================
   SPELL-SPECIFIC HELPERS
   ========================================================= */
function verifySpellLevel(level) {
  if (!Number.isInteger(level) || level < 0 || level > 9)
    throw new Error(`Spell level must be an integer between 0 and 9`);
}
function verifyMaterialComponent(components, material) {
  if (components.includes("M") && !material)
    throw new Error(`Material component required when 'M' is present`);
}
/* =========================================================
   MONSTER-SPECIFIC HELPERS
   ========================================================= */
function verifyAbilityScores(stats) {
  const requiredStats = ["str", "dex", "con", "int", "wis", "cha"];
  for (const stat of requiredStats) {
    if (!(stat in stats)) throw new Error(`Missing ability score: ${stat}`);
    if (typeof stats[stat] !== "number")
      throw new Error(`Ability score ${stat} must be numeric`);
  }
}
function verifyCrXpRule(monster) {
  if (monster.cr === undefined && monster.xp === undefined)
    throw new Error(`Monster must contain either CR or XP`);
}
function verifyCR(cr) {
  const allowedCRs = new Set([
    0,
    0.125,
    0.25,
    0.5,
    ...Array.from({ length: 30 }, (_, i) => i + 1)
  ]);
  if (cr === undefined) return;
  if (!allowedCRs.has(cr))
    throw new Error(`Invalid CR value: ${cr}. Must be 0, 1/8, 1/4, 1/2, or 1–30`);
}
/* =========================================================
   MAGIC ITEM HELPERS
   ========================================================= */
function verifyAttunementLogic(attunement, restrictions) {
  if (!attunement && restrictions && restrictions.length > 0)
    throw new Error(`Attunement restrictions require attunement = true`);
}
/* =========================================================
   EXPORTS
   ========================================================= */
export {
  verifyBatch,
  verifyRecord,
  canonicalizeRecordForOrdering,
  canonicalizeString,
  verifyRequiredFields,
  verifyNonEmptyArray,
  verifyStringArray,
  verifyNumberField,
  verifyBooleanField,
  verifySources,
  verifyIdFormat,
  verifyNoNulls,
  verifySpellLevel,
  verifyMaterialComponent,
  verifyAbilityScores,
  verifyCrXpRule,
  verifyCR,
  verifyAttunementLogic
};