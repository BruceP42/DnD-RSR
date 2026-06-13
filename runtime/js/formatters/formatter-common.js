/* --------------------------------------------------------- */
// Path:         runtime/js/formatters/formatter-common.js
// File:         formatter-common.js
// Version:      V2.7
// Data Schema:  V1.1
// System:       RSR (D&D Reference System)
// Module/Role:  Centralized formatter registry — all format keys resolve here
// Dependencies: formatter-spell.js, formatter-monster.js, formatter-magic-item.js
// Created:      2026-04-11
// Last Updated: 2026-05-16
// Changelog:
//   V2.7:
//    - _renderMarkdownTable: apply hasSeparator detection (same logic as _parseMarkdownTable in normalize-magic-items.js V1.4). Previous code always used slice(2), silently dropping the first data row of DMG14-format tables that have no separator row (e.g. Alchemy Jug "Acid" row). Fix: detect separator on line 1 with /^[\|\-\s:]+$/ and set dataStart to 2 (separator present) or 1 (no separator).
//   V2.6:
//    - paragraphs formatter now calls _groupTableRows before dispatch. Fixes SRD raw format where each table row is a separate array element (e.g. "| Lever | Up | Down |", "|---|---|---|", "| 1 | ... |"). Without grouping, each row dispatched individually to _renderDescItem produced a separate one-row <table> per row — broken output. _groupTableRows collapses consecutive |-prefixed strings into a single newline-joined string before dispatch; single-string tables (DMG14 format) and prose strings pass through unchanged.
//    - markdown fallback in _renderDescItem is TEMPORARY pending Step 11 pipeline normalization. When normalize-magic-items.js is updated to convert markdown strings to typed objects on build and the runtime dataset is regenerated, remove _groupTableRows, the markdown fallback branch in _renderDescItem, and _renderMarkdownTable. The typed-object path in _renderDescItem remains. See TODO: Migrate item_desc Markdown Tables to Structured Schema.
//   V2.5:
//    - paragraphs formatter updated to support typed objects ({ type: "paragraph", text } and { type: "table", headers, rows }).
//    - Backward-compatible: bare strings still render correctly via markdown fallback during interim period before Step 11 pipeline normalization.
//    - Private helpers added: _renderDescItem, _renderDescTable, _renderMarkdownTable.
//   V2.4:
//    - Added titleCase formatter to shared registry.
//   V2.3:
//    - Registered magicItemFormatters; safeFormat export preserved.
/* --------------------------------------------------------- */

import { spellFormatters }     from "./formatter-spell.js";
import { monsterFormatters }   from "./formatter-monster.js";
import { magicItemFormatters } from "./formatter-magic-item.js";

// ----------------------------
// safeFormat
// ----------------------------
/**
 * Higher-order wrapper for domain formatters.
 * Returns "" when value is null, undefined, or empty string —
 * causing the renderer to suppress the field row entirely.
 *
 * @param {Function} fn - the inner formatter function
 * @returns {Function} wrapped formatter
 */
export function safeFormat(fn) {
  return function (value) {
    if (value == null || value === "") return "";
    return fn(value);
  };
}

/**
 * Check whether a value is empty (null, undefined, empty string, or empty array).
 * Used by domain formatters for nullable field guards.
 *
 * @param {*} value
 * @returns {boolean}
 */
export function isEmpty(value) {
  if (value == null || value === "") return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
}

// ----------------------------
// Formatter Registry
// ----------------------------
const formatterRegistry = {

  // ── Shared ──────────────────────────────────────────────
  titleCase(value) {
    if (!value || typeof value !== "string") return "";
    return value.replace(/\b\w/g, c => c.toUpperCase());
  },

  string(value) {
    return value != null ? String(value) : "";
  },

  number(value) {
    return value != null ? String(value) : "";
  },

  boolean(value) {
    return value === true ? "Yes" : value === false ? "No" : "";
  },

  duration(value) {
    return value != null ? String(value) : "";
  },

  range(value) {
    return value != null ? String(value) : "";
  },

  components(value) {
    if (!Array.isArray(value)) return "";
    return value.join(", ");
  },

  school(value) {
    if (!value || typeof value !== "string") return "";
    return value.charAt(0).toUpperCase() + value.slice(1);
  },

  dice(value) {
    return value != null ? String(value) : "";
  },

  classList(value) {
    if (!Array.isArray(value)) return "";
    return value.join(", ");
  },

  sourceList(value) {
    if (!Array.isArray(value)) return "";
    return value.map(s => s.source ?? s).join(", ");
  },

  paragraphs(value) {
    if (!Array.isArray(value)) return "";
    return _groupTableRows(value)
      .map(item => _renderDescItem(item))
      .join("\n");
  },

  // ── Spell-specific ───────────────────────────────────────
  ...spellFormatters,

  // ── Monster-specific ─────────────────────────────────────
  ...monsterFormatters,

  // ── Magic-item-specific ──────────────────────────────────
  ...magicItemFormatters,

};

// ----------------------------
// Private — desc / item_desc rendering
// ----------------------------

/**
 * Collapse consecutive |-prefixed strings into single newline-joined strings
 * before dispatch to _renderDescItem.
 *
 * Raw data arrives in two formats:
 *   SRD format   — each table row is a separate array element:
 *                  ["| Col A | Col B |", "|---|---|", "| val | val |"]
 *   DMG14 format — entire table is one string with \n separators:
 *                  ["|Col A|Col B|\n|val|val|"]
 * Both formats produce a single \n-joined string after grouping, which
 * _renderMarkdownTable can parse uniformly.
 * Typed objects (Option D) and prose strings pass through unchanged.
 *
 * TEMPORARY — remove once Step 11 pipeline normalization is complete and
 * the runtime dataset no longer contains markdown strings.
 * See TODO: Migrate item_desc Markdown Tables to Structured Schema.
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
 * Render a single desc array element.
 *
 * Typed objects (Option D) are the target format produced by the pipeline
 * after Step 11 normalization. The markdown string fallback handles the
 * interim period where the runtime dataset still contains raw markdown
 * strings — it is removed when the runtime dataset is regenerated.
 *
 * @param {Object|string} item
 * @returns {string} HTML string
 */
function _renderDescItem(item) {
  // ── Typed object (Option D) ──────────────────────────────
  if (item !== null && typeof item === "object") {
    if (item.type === "table")     return _renderDescTable(item);
    if (item.type === "paragraph") return `<p>${item.text}</p>`;
    return ""; // unknown type — suppress silently
  }

  // ── Markdown string fallback — TEMPORARY ─────────────────
  // Handles markdown strings still present in the runtime dataset before
  // Step 11 pipeline normalization runs and regenerates the dataset.
  // After regeneration: remove this branch, _groupTableRows, and
  // _renderMarkdownTable entirely.
  // See TODO: Migrate item_desc Markdown Tables to Structured Schema.
  if (typeof item === "string") {
    if (item.trimStart().startsWith("|")) return _renderMarkdownTable(item);
    return `<p>${item}</p>`;
  }

  return "";
}

/**
 * Render a typed table object as an HTML table.
 *
 * @param {{ headers: string[], rows: string[][] }} descriptor
 * @returns {string} HTML string
 */
function _renderDescTable({ headers = [], rows = [] }) {
  const headerHtml = headers.map(h => `<th>${h}</th>`).join("");
  const rowHtml    = rows.map(r =>
    `<tr>${r.map(c => `<td>${c}</td>`).join("")}</tr>`
  ).join("");
  return `<table class="desc-table">
    <thead><tr>${headerHtml}</tr></thead>
    <tbody>${rowHtml}</tbody>
  </table>`;
}

/**
 * Parse a markdown table string and delegate to _renderDescTable.
 * Handles both formats after _groupTableRows has normalised them:
 *   Line 0 = headers, line 1 = separator row (skipped), lines 2+ = data rows.
 *
 * TEMPORARY — remove with the markdown fallback when Step 11 is complete.
 * See TODO: Migrate item_desc Markdown Tables to Structured Schema.
 *
 * @param {string} str
 * @returns {string} HTML string
 */
function _renderMarkdownTable(str) {
  const lines   = str.split("\n").map(l => l.trim()).filter(Boolean);
  const headers = lines[0].split("|").map(c => c.trim()).filter(Boolean);

  const hasSeparator = lines.length > 1 && /^[\|\-\s:]+$/.test(lines[1]);
  const dataStart    = hasSeparator ? 2 : 1;

  const rows = lines.slice(dataStart).map(l =>
    l.split("|").map(c => c.trim()).filter(Boolean)
  );
  return _renderDescTable({ headers, rows });
}

// ----------------------------
// Exports
// ----------------------------

/**
 * Resolve a format key to a formatter function.
 * Returns the `string` fallback if the key is not registered.
 */
export function getFormatter(key) {
  return formatterRegistry[key] ?? formatterRegistry.string;
}

/**
 * Direct registry export for renderers that resolve format keys
 * by indexing the registry object directly (e.g. formatters[key]).
 */
export { formatterRegistry as formatters };
