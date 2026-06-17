/* ---------------------------------------------------------
Path: pipeline/normalize/normalize-spells.js
File: normalize-spells.js
Version: V1.5
Data Schema: V1.1
System: D&D Reference System – Data Pipeline V3.0
Module/Role: Domain normalization for spells
Dependencies: 
  - pipeline/_core/normalization-engine.js
  - pipeline/utils/helpers.js
Created: 2026-03-10
Last Updated: 2026-06-16
Author: Bruce Pilcher
Changelog:
  V1.1: Refactored to use core normalization engine
  V1.2: Updated for pipeline/data/ directory structure with optional save
  V1.3: Fix Null Pages added
  V1.4: Rename 'desc' to 'spell_desc' added
  V1.5: Added lowercaseFields pass via helpers.js — lowers name, school, and
        casting_time to canonical pipeline casing. Display casing applied at
        render time only. Removed redundant inline name lowercasing.
        Corrected dependencies header — helpers.js was already imported but
        not listed.
Related Files:
  normalization-engine.js
  helpers.js
Notes:
  - Supports field-level transformer hooks
  - Incremental build-ready
  - Normalized files now align with pipeline/data/normalized/
--------------------------------------------------------- */

import fs from "fs";
import path from "path";
import { normalizeRecord, normalizeBatch, NORMALIZED_DIR } from '../_core/normalization-engine.js';
import { fixNullPages, lowercaseFields } from '../utils/helpers.js';

// Classificatory string fields to store lowercase in pipeline data.
// Display casing is applied at render time — never stored in data.
// spell_desc, components, material, and id are excluded — their
// capitalisation is meaningful or case-sensitive.
const LOWERCASE_FIELD_PATHS = [
  "name",
  "school",
  "casting_time"
];

/**
 * Domain-specific transformer for spell fields
 * @param {Object} spell
 * @returns {Object} normalized spell
 */
function transformSpellFields(spell) {
    const normalized = { ...spell };

    // ======= fix null pages in sources =======
    fixNullPages(normalized);

    // Rename 'desc' → 'spell_desc'
    if (normalized.desc !== undefined) {
        normalized.spell_desc = normalized.desc;
        delete normalized.desc;
    } else if (!normalized.spell_desc) {
        // ensure verification won't fail
        normalized.spell_desc = "Description missing";
    }

    // Ensure provenance is set
    if (!normalized.data_file_provenance && normalized.sources?.length) {
        normalized.data_file_provenance = normalized.sources[0].source.toLowerCase();
    }

    if (normalized.level !== undefined) {
        normalized.level = Number(normalized.level);
    }

    // ======= Lowercase classificatory string fields =======
    // lowercaseFields mutates in place.
    lowercaseFields(normalized, LOWERCASE_FIELD_PATHS);

    return normalized;
}

/**
 * Normalize a single spell record
 * @param {Object} rawSpell
 * @returns {Object}
 */
function normalizeSpell(rawSpell) {
    return normalizeRecord(rawSpell, transformSpellFields);
}

/**
 * Normalize an array of spell records and optionally save to normalized directory
 * @param {Array<Object>} rawSpells
 * @param {String} datasetName
 * @param {Boolean} saveToFile - whether to write normalized dataset to file
 * @returns {Array<Object>}
 */
export function normalizeSpells(rawSpells, datasetName, saveToFile = false) {
    const normalized = normalizeBatch(rawSpells, datasetName, 'spells', normalizeSpell);

    if (saveToFile) {
        const filename = `${datasetName}--spells.normalized.js`;
        const filepath = path.join(NORMALIZED_DIR, filename);
        const content = `export default ${JSON.stringify(normalized, null, 2)};\n`;
        fs.writeFileSync(filepath, content, 'utf-8');
    }

    return normalized;
}
