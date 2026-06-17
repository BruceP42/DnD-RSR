/* ---------------------------------------------------------
Path: pipeline/normalize/normalize-magic-items.js
File: normalize-magic-items.js
Version: V1.5
Data Schema: V1.1
System: D&D Reference System – Data Pipeline V3.0
Module/Role: Domain normalization for magic-items
Dependencies:
  - pipeline/_core/normalization-engine.js
  - pipeline/utils/helpers.js
Created: 2026-03-10
Last Updated: 2026-06-16
Author: Bruce Pilcher
Changelog:
  V1.1: Refactored to use core normalization engine.
  V1.2: Updated for pipeline/data/ directory structure with optional save.
  V1.3: Fix Null Pages added.
  V1.4: desc → item_desc conversion now normalizes markdown table strings
        to typed objects ({ type: "table", headers, rows }) via
        _normalizeDescArray. Handles both raw formats found in source data:
          SRD format   — each table row as a separate array element with a
                         separator row (|---|---|) on line 1.
          DMG14 format — entire table as a single \n-delimited string with
                         no separator row.
        Consecutive |-prefixed strings (SRD format) are collapsed by
        _groupTableRows before parsing. Separator row detection uses a
        regex check on line 1 so both formats resolve correctly.
        Plain prose strings are passed through unchanged.
        Already-typed objects are passed through unchanged (defensive).
        After running the pipeline with this version and regenerating the
        runtime dataset, remove _groupTableRows, the startsWith("|") branch,
        and _renderMarkdownTable from formatter-common.js (V2.7).
        See TODO: Migrate item_desc Markdown Tables to Structured Schema.
  V1.5: Added lowercaseFields pass via helpers.js — lowers name,
        magic_item_category, and rarity to canonical pipeline casing.
        Removed redundant inline lowercasing for those three fields.
        Display casing applied at render time only.
        Note: magic_item_type lowercasing remains inline — it is part of
        a rename-and-transform from item_type and cannot be expressed as
        a simple field path.
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
// item_desc, id, and attunement_restrictions are excluded — their
// capitalisation is meaningful or case-sensitive.
// Note: magic_item_type is lowercased inline because it is derived
// from a field rename (item_type → magic_item_type).
const LOWERCASE_FIELD_PATHS = [
  "name",
  "magic_item_category",
  "rarity"
];

// ── Private — desc normalization ───────────────────────────────────────────

/**
 * Normalize a desc array for the item_desc field.
 * Converts markdown table strings to typed objects; passes prose strings
 * and already-typed objects through unchanged.
 *
 * @param {Array} desc
 * @returns {Array}
 */
function _normalizeDescArray(desc) {
  if (!Array.isArray(desc)) return desc;

  return _groupTableRows(desc).map(el => {
    // Already a typed object — pass through unchanged.
    if (el !== null && typeof el === "object") return el;

    // Markdown table string — convert to typed object.
    if (typeof el === "string" && el.trimStart().startsWith("|")) {
      return _parseMarkdownTable(el);
    }

    // Plain prose string — pass through unchanged.
    return el;
  });
}

/**
 * Collapse consecutive |-prefixed strings (SRD row-per-element format) into
 * single newline-joined strings before parsing.
 *
 * SRD format stores one row per array element:
 *   ["| Col A | Col B |", "|---|---|", "| val | val |"]
 *
 * DMG14 format stores the whole table as one string:
 *   ["|Col A|Col B|\n|val|val|"]
 *
 * After grouping, both formats are a single \n-joined string that
 * _parseMarkdownTable can handle uniformly.
 *
 * @param {Array} elements
 * @returns {Array}
 */
function _groupTableRows(elements) {
  const result = [];
  let tableBuffer = [];

  for (const el of elements) {
    const isMarkdownRow =
      typeof el === "string" && el.trimStart().startsWith("|");

    if (isMarkdownRow) {
      tableBuffer.push(el.trim());
    } else {
      if (tableBuffer.length) {
        result.push(tableBuffer.join("\n"));
        tableBuffer = [];
      }
      result.push(el);
    }
  }

  if (tableBuffer.length) result.push(tableBuffer.join("\n"));
  return result;
}

/**
 * Parse a markdown table string into a typed table object.
 *
 * Handles two separator conventions:
 *   With separator row    — line 1 is |---|---| (SRD format); data starts at line 2.
 *   Without separator row — line 1 is the first data row (DMG14 format); data starts at line 1.
 *
 * @param {string} str
 * @returns {{ type: "table", headers: string[], rows: string[][] }}
 */
function _parseMarkdownTable(str) {
  const lines = str.split("\n").map(l => l.trim()).filter(Boolean);

  const headers = lines[0].split("|").map(c => c.trim()).filter(Boolean);

  const hasSeparator =
    lines.length > 1 && /^[\|\-\s:]+$/.test(lines[1]);
  const dataStart = hasSeparator ? 2 : 1;

  const rows = lines.slice(dataStart).map(l =>
    l.split("|").map(c => c.trim()).filter(Boolean)
  );

  return { type: "table", headers, rows };
}

// ── Domain transformer ─────────────────────────────────────────────────────

/**
 * Domain-specific transformer for magic-item fields.
 *
 * @param {Object} item
 * @returns {Object} normalized magic item
 */
function transformMagicItemFields(item) {
  const normalized = { ...item };

  // ── fix null pages in sources ──────────────────────────────────────────
  fixNullPages(normalized);

  // ── ensure provenance ──────────────────────────────────────────────────
  if (!normalized.data_file_provenance && normalized.sources?.length) {
    normalized.data_file_provenance = normalized.sources[0].source.toLowerCase();
  }

  // ── normalize item subtype ─────────────────────────────────────────────
  // Inline rather than via lowercaseFields — this is a rename-and-transform
  // (item_type → magic_item_type), not a simple field lowercasing.
  if ("item_type" in normalized) {
    const subtype = normalized.item_type?.trim?.();
    if (subtype) {
      normalized.magic_item_type = subtype.toLowerCase();
    }
    delete normalized.item_type;
  }

  // ── normalize description ──────────────────────────────────────────────
  // Renames desc → item_desc and converts any markdown table strings to
  // typed objects ({ type: "table", headers, rows }).
  // Plain prose strings are passed through unchanged.
  // After the pipeline is run and the runtime dataset is regenerated,
  // remove the markdown fallback from formatter-common.js (V2.7).
  // See TODO: Migrate item_desc Markdown Tables to Structured Schema.
  if ("desc" in normalized) {
    normalized.item_desc = _normalizeDescArray(normalized.desc);
    delete normalized.desc;
  }

  // ── normalize attunement ───────────────────────────────────────────────
  if (normalized.attunement === undefined || normalized.attunement === null) {
    normalized.attunement = false;
  } else {
    normalized.attunement = Boolean(normalized.attunement);
  }

  // ── normalize attunement_restrictions ─────────────────────────────────
  if (!Array.isArray(normalized.attunement_restrictions)) {
    normalized.attunement_restrictions = [];
  }

  // ── normalize properties ───────────────────────────────────────────────
  if (!Array.isArray(normalized.properties)) {
    normalized.properties = [];
  }

  // ── normalize bonus ────────────────────────────────────────────────────
  if (normalized.bonus === undefined || normalized.bonus === null) {
    normalized.bonus = "";
  } else if (typeof normalized.bonus === "string") {
    normalized.bonus = normalized.bonus.trim();
  }

  // ── lowercase classificatory string fields ─────────────────────────────
  // Runs last. lowercaseFields mutates in place.
  lowercaseFields(normalized, LOWERCASE_FIELD_PATHS);

  return normalized;
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Normalize a single magic item record.
 *
 * @param {Object} rawItem
 * @returns {Object}
 */
function normalizeMagicItem(rawItem) {
  return normalizeRecord(rawItem, transformMagicItemFields);
}

/**
 * Normalize an array of magic item records and optionally save to the
 * normalized directory.
 *
 * @param {Array<Object>} rawItems
 * @param {string}        datasetName
 * @param {boolean}       saveToFile
 * @returns {Array<Object>}
 */
export function normalizeMagicItems(rawItems, datasetName, saveToFile = false) {
  const normalized = normalizeBatch(
    rawItems,
    datasetName,
    "magic-items",
    normalizeMagicItem,
  );

  if (saveToFile) {
    const filename = `${datasetName}--magic-items.normalized.js`;
    const filepath = path.join(NORMALIZED_DIR, filename);
    const content  = `export default ${JSON.stringify(normalized, null, 2)};\n`;
    fs.writeFileSync(filepath, content, "utf-8");
  }

  return normalized;
}
