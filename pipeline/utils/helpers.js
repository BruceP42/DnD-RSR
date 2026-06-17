/* ---------------------------------------------------------
Path: pipeline/utils/helpers.js
File: helpers.js
Version: V1.4
System: D&D Reference System – Data Pipeline V3.0
Module/Role: Reusable utility functions for normalization, verification, and aggregation
Dependencies:
  - None (pure utility functions)
Created: 2026-03-12
Last Updated: 2026-06-16
Author: Bruce Pilcher
Changelog:
  V1.0: Initial creation of universal helper module; includes reusable data cleaning and normalization helpers
  V1.1: fixNullPages modified to also change "" to "N/A"
  V1.2: Added collapseSignSpaces — collapses whitespace between a sign character (+ or -) and
        a digit in a string. Reusable rule for cleaning malformed bonus/dice expressions in
        any string field. e.g. "+ 15" → "+15", "2d10 + 6" → "2d10 +6" is intentionally
        NOT touched — only sign-digit adjacency is corrected.
  V1.3: Added splitNewlineDesc — splits a \n-delimited string into an array of trimmed
        non-empty strings. Returns value unchanged if no \n is present or value is not a
        string. Opt-in per field — not applied globally. Reusable by any normalizer.
  V1.4: Added lowercaseFields — walks a record and lowercases string values at paths
        declared by the caller. Paths use dot notation with [] to mark array iteration
        (e.g. "actions[].name", "traits[].spellcasting.spells[].name"). Non-string
        values and missing paths are silently skipped. Opt-in per domain — each
        normalizer declares its own field list. Implements the project-wide convention:
        canonical pipeline data is stored lowercase; display casing is applied at
        render time by renderers, never stored in data.
Related Files:
  normalize-spells.js
  normalize-monsters.js
  normalize-magic-items.js
Notes:
  - Intended as a central location for small reusable functions
  - Functions should be general-purpose and non-domain-specific
  - lowercaseFields path syntax: dot-separated segments; append [] to a segment
    to indicate the value at that segment is an array of objects to iterate over.
    Scalar segments without [] are plain object property traversals.
    Examples:
      "name"                                  top-level scalar
      "actions[].name"                        array at "actions", lowercase "name" on each item
      "actions[].damage[].damage_type.name"   nested array within array
      "traits[].spellcasting.spells[].name"   object within array, then nested array
--------------------------------------------------------- */

/* =========================================================
   UTILITY FUNCTIONS
   ========================================================= */

/**
 * Replace null, undefined, or empty page fields in a record's sources with "N/A"
 * @param {Object} record
 * @returns {Object} record with fixed pages
 */
export function fixNullPages(record) {
  if (record.sources && Array.isArray(record.sources)) {
    record.sources.forEach(src => {
      if (
        src.page === null ||
        src.page === undefined ||
        src.page === ""
      ) {
        src.page = "N/A";
      }
    });
  }
  return record;
}

/**
 * Ensure a field is always an array; wrap single values in array if necessary
 * @param {*} value
 * @returns {Array}
 */
export function ensureArray(value) {
  if (value === null || value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

/**
 * Trim and sanitize string; returns empty string for null/undefined
 * @param {*} str
 * @returns {string}
 */
export function sanitizeString(str) {
  return typeof str === "string" ? str.trim() : "";
}

/**
 * Collapse whitespace between a sign character (+ or -) and a digit.
 * Corrects malformed bonus and dice expressions in prose strings.
 *
 * Examples:
 *   "+ 15 to hit"          → "+15 to hit"
 *   "2d10 + 6"             → "2d10 +6"      (sign-digit pair corrected)
 *   "reach 10 ft., one"    → unchanged       (no sign-digit pair)
 *
 * Intended for use on desc strings within action arrays (actions,
 * reactions, legendary_actions, special_abilities). Opt-in per field —
 * not applied globally.
 *
 * @param {string} str
 * @returns {string}
 */
export function collapseSignSpaces(str) {
  if (typeof str !== "string") return str;
  return str.replace(/([+-])\s+(\d)/g, "$1$2");
}

/**
 * Split a \n-delimited string into an array of trimmed, non-empty strings.
 * Returns the value unchanged if:
 *   - value is not a string
 *   - value contains no \n character
 *
 * Intended for use on desc fields that encode multi-paragraph content as
 * a single \n-delimited string (e.g. breath weapon descriptions). The
 * renderer's existing multi-paragraph branch handles the resulting array
 * automatically.
 *
 * Opt-in per field — not applied globally. Reusable by any normalizer.
 *
 * Examples:
 *   "First paragraph.\nSecond paragraph."
 *     → ["First paragraph.", "Second paragraph."]
 *
 *   "Single paragraph with no newline."
 *     → "Single paragraph with no newline."   (unchanged)
 *
 *   "Line one.\n\nLine three."               (empty line between)
 *     → ["Line one.", "Line three."]          (empty strings filtered out)
 *
 * @param {string} value
 * @returns {string|string[]}
 */
export function splitNewlineDesc(value) {
  if (typeof value !== "string") return value;
  if (!value.includes("\n")) return value;

  const parts = value.split("\n").map(s => s.trim()).filter(s => s.length > 0);

  // If splitting produces only one non-empty part, return as plain string
  return parts.length === 1 ? parts[0] : parts;
}

/**
 * Lowercase string values at declared field paths within a record.
 *
 * Implements the project-wide data casing convention: canonical pipeline
 * data is stored lowercase; display casing is applied at render time by
 * renderers, never stored in data.
 *
 * Each normalizer opts in by passing its own fieldPaths list — only the
 * declared paths are touched. Non-string values and missing paths are
 * silently skipped. The record is mutated in place.
 *
 * Path syntax:
 *   "name"                                 top-level scalar
 *   "actions[].name"                       array at "actions"; lowercase "name" on each item
 *   "actions[].damage[].damage_type.name"  nested array within array
 *   "traits[].spellcasting.spells[].name"  plain object traversal, then nested array
 *
 * Segments ending with [] denote an array to iterate over.
 * Segments without [] denote plain object property traversal.
 *
 * @param {Object} record - the record to mutate
 * @param {string[]} fieldPaths - list of dot-notation path strings
 */
export function lowercaseFields(record, fieldPaths) {
  for (const fieldPath of fieldPaths) {
    _walkPath(record, fieldPath.split("."), 0);
  }
}

/**
 * Recursive walker for lowercaseFields.
 * Traverses the segments of a split path, iterating arrays where indicated,
 * and lowercases the string value found at the final segment.
 *
 * @param {Object|Array} node  - current position in the record
 * @param {string[]}     segs  - remaining path segments
 * @param {number}       idx   - current segment index
 */
function _walkPath(node, segs, idx) {
  if (node === null || node === undefined) return;
  if (idx >= segs.length) return;

  const seg = segs[idx];
  const isArray = seg.endsWith("[]");
  const key = isArray ? seg.slice(0, -2) : seg;
  const isLast = idx === segs.length - 1;

  if (isArray) {
    // This segment is an array field — iterate and recurse into each element
    const arr = node[key];
    if (!Array.isArray(arr)) return;
    for (const item of arr) {
      _walkPath(item, segs, idx + 1);
    }
  } else if (isLast) {
    // Final segment — lowercase the value if it is a string
    if (typeof node[key] === "string") {
      node[key] = node[key].toLowerCase();
    }
  } else {
    // Intermediate plain object traversal — step into the property
    _walkPath(node[key], segs, idx + 1);
  }
}
