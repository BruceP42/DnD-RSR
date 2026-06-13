/* ---------------------------------------------------------
Path: pipeline/utils/helpers.js
File: helpers.js
Version: V1.3
System: D&D Reference System – Data Pipeline V3.0
Module/Role: Reusable utility functions for normalization, verification, and aggregation
Dependencies:
  - None (pure utility functions)
Created: 2026-03-12
Last Updated: 2026-06-10
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
Related Files:
  normalize-spells.js
  normalize-monsters.js
  normalize-magic-items.js
Notes:
  - Intended as a central location for small reusable functions
  - Functions should be general-purpose and non-domain-specific
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
