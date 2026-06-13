/* ---------------------------------------------------------
Path: pipeline/normalize/normalize-monsters.js
File: normalize-monsters.js
Version: V1.8
Data Schema: V1.1
System: D&D Reference System – Data Pipeline V3.0
Module/Role: Domain normalization for monsters
Dependencies: 
  - pipeline/_core/normalization-engine.js
  - pipeline/utils/provenance.js
  - pipeline/utils/logging.js
  - pipeline/utils/helpers.js
Created: 2026-03-10
Last Updated: 2026-06-10
Author: Bruce Pilcher
Changelog:
  V1.1: Refactored to use core normalization engine
  V1.2: Updated for pipeline/data/ directory structure with optional save
  V1.3: Fix Null Pages added
  V1.4: Added normalizer to combine separate ability score fields into single ability_scores field
  V1.5: Added CR parsing and CR↔XP normalization logic with provenance flags
  V1.6: Corrected normalized.ability_scores = { from looking for upper case keys i.e. STR to lower case i.e. str
  V1.7: Added action desc normalization — normalizeActionDescs():
        (a) collapseSignSpaces applied to all desc strings in actions, reactions,
            legendary_actions, and special_abilities; corrects malformed bonus
            expressions e.g. "+ 15" → "+15". Auto-corrects with logWarning per record.
        (b) desc strings containing ". Hit: " are split into a two-element array
            ["<to-hit clause>.", "Hit: <damage clause>"] so the renderer can
            display to-hit and damage on separate lines without hardcoding
            display logic in the renderer. The renderer's existing multi-paragraph
            branch handles this automatically.
  V1.8: Extended normalizeActionDescs() with step 3 — splitNewlineDesc applied to
        desc strings after collapseSignSpaces and ". Hit: " split. Converts
        \n-delimited multi-paragraph desc strings (e.g. breath weapon entries)
        into arrays. splitNewlineDesc is a no-op if no \n is present, so this
        step is safe to apply unconditionally to all action desc strings.
        splitNewlineDesc imported from helpers.js.
Related Files:
  normalization-engine.js
  helpers.js
Notes:
  - Supports field-level transformer hooks
  - Incremental build-ready
  - Normalized files now align with pipeline/data/normalized/
  - ACTION_ARRAY_FIELDS lists all action-bearing fields; add new fields here
    if the schema grows (e.g. villain_actions, lair_actions)
  - collapseSignSpaces is a reusable helper in helpers.js; opt-in per field
  - splitNewlineDesc is a reusable helper in helpers.js; opt-in per field
  - ". Hit: " split is reliable across all 533 SRD attack action descs;
    verified by query against monsters-dataset.js (2026-06-09)
  - Step 3 (\n split) runs after step 2 (". Hit: " split); if step 2 already
    converted desc to an array, step 3 is skipped (guard: typeof item.desc !== "string")
--------------------------------------------------------- */

import fs from "fs";
import path from "path";
import { normalizeRecord, normalizeBatch, NORMALIZED_DIR } from '../_core/normalization-engine.js';
import { fixNullPages, collapseSignSpaces, splitNewlineDesc } from '../utils/helpers.js';
import { getXPFromCR, getCRFromXP, parseCRValue } from "../utils/crxp-helpers.js";
import { logWarning } from "../utils/logging.js";

// All fields that carry arrays of action objects with desc strings.
// Add new fields here if the schema grows.
const ACTION_ARRAY_FIELDS = [
  "actions",
  "reactions",
  "legendary_actions",
  "special_abilities"
];

/**
 * Normalize desc strings across all action array fields.
 * For each action item:
 *   1. collapseSignSpaces — removes erroneous whitespace between sign and digit
 *   2. Split on ". Hit: " — converts attack descs to two-element arrays so the
 *      renderer can display to-hit and damage clauses on separate lines.
 *   3. splitNewlineDesc — splits \n-delimited desc strings into arrays so the
 *      renderer can display multi-paragraph descs (e.g. breath weapons) correctly.
 *      No-op if no \n present. Skipped if step 2 already converted desc to array.
 *
 * Logs a warning when collapseSignSpaces changes a string, naming the monster
 * and field so the source data issue is visible in pipeline output.
 *
 * @param {Object} normalized - monster record (mutated in place)
 */
function normalizeActionDescs(normalized) {
  for (const field of ACTION_ARRAY_FIELDS) {
    if (!Array.isArray(normalized[field])) continue;

    normalized[field] = normalized[field].map(item => {
      if (typeof item.desc !== "string") return item;

      // --- Step 1: collapse sign spaces
      const cleaned = collapseSignSpaces(item.desc);
      if (cleaned !== item.desc) {
        logWarning(
          `collapseSignSpaces corrected desc in ${field} action "${item.name ?? "[unnamed]"}" ` +
          `on monster "${normalized.name ?? "[unnamed]"}"`,
          "normalization"
        );
      }

      // --- Step 2: split on attack hit boundary
      const HIT_MARKER = ". Hit: ";
      if (cleaned.includes(HIT_MARKER)) {
        const idx        = cleaned.indexOf(HIT_MARKER);
        const toHitPart  = cleaned.slice(0, idx + 1);       // includes the period
        const damagePart = "Hit: " + cleaned.slice(idx + HIT_MARKER.length);
        return { ...item, desc: [toHitPart, damagePart] };
      }

      // --- Step 3: split \n-delimited multi-paragraph descs
      // splitNewlineDesc is a no-op if no \n present — safe to apply unconditionally.
      // Only reached if step 2 did not convert desc to an array.
      return { ...item, desc: splitNewlineDesc(cleaned) };
    });
  }
}

/**
 * Domain-specific transformer for monster fields
 * @param {Object} monster
 * @returns {Object} normalized monster
 */
function transformMonsterFields(monster) {
    const normalized = { ...monster };

    // ======= fix null pages in sources =======
    fixNullPages(normalized);
    
    // Ensure provenance is set
    if (!normalized.data_file_provenance && normalized.sources?.length) {
        normalized.data_file_provenance = normalized.sources[0].source.toLowerCase();
    }

    // Canonicalize ordering-critical fields
    if (normalized.name && typeof normalized.name === 'string') {
        normalized.name = normalized.name.trim().toLowerCase();
    }

    // ======= Normalize CR/XP =======
    
    // Normalize CR value first
    if (normalized.cr !== undefined && normalized.cr !== null) {
        normalized.cr = parseCRValue(normalized.cr);
    }
    
    const crGiven = normalized.cr !== undefined && normalized.cr !== null;
    const xpGiven = normalized.xp !== undefined && normalized.xp !== null;
    
    normalized.cr_given = crGiven;
    normalized.xp_given = xpGiven;
    
    // If CR exists but XP does not → derive XP
    if (crGiven && !xpGiven) {
        normalized.xp = getXPFromCR(normalized.cr);
        normalized.cr_xp_mismatch = false;
    }
    
    // If XP exists but CR does not → derive CR
    else if (!crGiven && xpGiven) {
        normalized.cr = getCRFromXP(normalized.xp);
        normalized.cr_xp_mismatch = false;
    }
    
    // If both exist → check mismatch
    else if (crGiven && xpGiven) {
        const expectedXP = getXPFromCR(normalized.cr);
        normalized.cr_xp_mismatch = expectedXP !== normalized.xp;
    }

    // ======= Normalize ability scores =======
    // Collect the six flat raw keys into a nested ability_scores object.
    // Raw schema uses lowercase keys (str, dex, con, int, wis, cha).
    // Defaults to 0 if a key is absent or null.
    normalized.ability_scores = {
        str: Number(normalized.str ?? 0),
        dex: Number(normalized.dex ?? 0),
        con: Number(normalized.con ?? 0),
        int: Number(normalized.int ?? 0),
        wis: Number(normalized.wis ?? 0),
        cha: Number(normalized.cha ?? 0)
    };
    
    // Remove the flat keys — ability_scores is now the canonical location.
    delete normalized.str;
    delete normalized.dex;
    delete normalized.con;
    delete normalized.int;
    delete normalized.wis;
    delete normalized.cha;

    // ======= Normalize action desc strings =======
    normalizeActionDescs(normalized);
    
    return normalized;
}

/**
 * Normalize a single monster record
 * @param {Object} rawMonster
 * @returns {Object}
 */
function normalizeMonster(rawMonster) {
    return normalizeRecord(rawMonster, transformMonsterFields);
}

/**
 * Normalize an array of monster records and optionally save to normalized directory
 * @param {Array<Object>} rawMonsters
 * @param {String} datasetName
 * @param {Boolean} saveToFile - whether to write normalized dataset to file
 * @returns {Array<Object>}
 */
export function normalizeMonsters(rawMonsters, datasetName, saveToFile = false) {
    const normalized = normalizeBatch(rawMonsters, datasetName, 'monsters', normalizeMonster);

    if (saveToFile) {
        const filename = `${datasetName}--monsters.normalized.js`;
        const filepath = path.join(NORMALIZED_DIR, filename);
        const content = `export default ${JSON.stringify(normalized, null, 2)};\n`;
        fs.writeFileSync(filepath, content, 'utf-8');
    }

    return normalized;
}
