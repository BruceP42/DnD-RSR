/* ---------------------------------------------------------
Path: runtime/js/renderers/render-helpers.js
File: render-helpers.js
Version: V1.3
Data Schema: N/A
System: D&D Reference System - Reference System Runtime (RSR)
Module/Role: Shared rendering helper functions used across
  multiple renderers (stat-block-renderer, card-renderer, etc.).
  Extracted here so that visual changes to shared UI elements
  (e.g. source attribution) apply everywhere simultaneously.
Dependencies:
  - runtime/js/registry/sources-registry.js
Created: 2026-04-19
Last Updated: 2026-06-09
Author: Bruce Pilcher
Changelog:
  V1.3:
  - renderCRXP: primary label now wrapped in <strong> in all six
    cases so CR/XP label renders bold and in label colour,
    consistent with all other stat block fields. Secondary label
    inside parenthetical remains plain text.
  V1.2:
  - Added import of resolveSource from sources-registry.js
  - renderSources() now resolves source IDs to display names via
    resolveSource(). Falls back to raw s.source string when no
    record is found (safety net for unrecognized IDs only).
  V1.1:
  - Added renderCreatureMeta: size/type/subtype/alignment as single comma-separated string
  - Added renderArmorClass: ac (armor type) combined string
  - Added renderHitPoints: hp (hit dice) combined string
  - Added renderCRXP: six-case CR/XP provenance matrix with configurable labels; shared by card and stat-block renderers
  - Added internal formatCRValue and flag helpers
  V1.0: Initial release
    - renderSources: renders a sources array as a right-aligned block of left-aligned per-source paragraphs using .source-list and .source-list p CSS classes
Related Files:
  runtime/js/renderers/stat-block-renderer.js
  runtime/js/renderers/card-renderer.js
  runtime/js/registry/sources-registry.js
Notes:
  - All functions return HTML strings
  - CSS for .source-list lives in rsr.css
  - One source per <p> — block element by nature, no flexbox
    dependency for line separation
  - page value "N/A" is suppressed; absent page also suppressed
  - resolveSource() returns the full source record; renderSources()
    uses .name for display. Future callers may use .short,
    .publisher, .year for tooltips or filter UI.
  - Fallback to raw s.source string is a safety net only — once
    all datasets use canonical source IDs the fallback path
    should never be hit in normal operation.
--------------------------------------------------------- */

import { resolveSource } from "../registry/sources-registry.js";

/**
 * Render a sources array as a right-aligned block of left-aligned per-source paragraphs.
 * Source IDs are resolved to display names via the sources registry.
 * Falls back to the raw s.source string if the ID is not found.
 *
 * @param {Array} sources - array of { source, page } objects
 * @returns {string} HTML string, or "" if sources is empty/absent
 */
export function renderSources(sources) {
  if (!Array.isArray(sources) || sources.length === 0) return "";

  const items = sources
    .map(s => {
      const record     = resolveSource(s.source);
      const sourceName = record ? record.name : s.source;
      const page       = s.page && s.page !== "N/A" ? `, p. ${s.page}` : "";
      return `<p>${sourceName}${page}</p>`;
    })
    .join("\n");

  return `<div class="source-list">\n  <div>\n${items}\n  </div>\n</div>`;
}

/**
 * Format CR as a fraction string for display.
 * 0.125 → "1/8", 0.25 → "1/4", 0.5 → "1/2", integers as-is.
 *
 * @param {number} cr
 * @returns {string}
 */
function formatCRValue(cr) {
  if (cr === 0.125) return "1/8";
  if (cr === 0.25)  return "1/4";
  if (cr === 0.5)   return "1/2";
  return String(cr);
}

/** Render a provenance flag as a superscript with native tooltip. */
function flag(symbol, title) {
  return `<sup title="${title}">${symbol}</sup>`;
}

const FLAG_GIVEN    = flag("†", "Value given in original source");
const FLAG_DERIVED  = flag("≈", "Value derived by calculation");
const FLAG_MISMATCH = `<span title="Source gives both CR and XP but values do not align with the standard conversion">⚠</span>`;

/**
 * Render creature meta line: size, type, optional subtype, alignment.
 * Returns a plain string — callers wrap it in their own HTML.
 * e.g. "Medium humanoid (goblinoid), chaotic evil"
 *
 * @param {Object} record - monster data record
 * @returns {string}
 */
export function renderCreatureMeta(record) {
  const size         = record.size          ?? "";
  const creatureType = record.creature_type ?? "";
  const subtype      = record.subtype;
  const alignment    = record.alignment     ?? "";

  const typePart = subtype
    ? `${size} ${creatureType} (${subtype})`
    : `${size} ${creatureType}`;

  return [typePart, alignment].filter(Boolean).join(", ");
}

/**
 * Render armor class with optional armor type in parentheses.
 * e.g. "17 (Natural Armor)" or "8"
 *
 * @param {Object} record - monster data record
 * @returns {string}
 */
export function renderArmorClass(record) {
  const ac        = record.ac        ?? "";
  const armorType = record.armor_type;
  return armorType
    ? `${ac} (${armorType})`
    : String(ac);
}

/**
 * Render hit points with hit dice in parentheses.
 * e.g. "135 (18d10)" or "22 (3d8+9)"
 *
 * @param {Object} record - monster data record
 * @returns {string}
 */
export function renderHitPoints(record) {
  const hp      = record.hp       ?? "";
  const hitDice = record.hit_dice;
  return hitDice
    ? `${hp} (${hitDice})`
    : String(hp);
}

/**
 * Render CR/XP using the six-case provenance matrix.
 * Shared by card-renderer.js and stat-block-renderer.js.
 * Labels are passed in so callers can use their preferred
 * wording — stat-block uses "Challenge"/"Experience Points",
 * card uses "CR"/"XP".
 *
 * @param {Object} record          - monster data record
 * @param {string} crLabel         - label for CR-primary display
 * @param {string} xpLabel         - label for XP-primary display
 * @returns {string} rendered HTML string
 */
export function renderCRXP(record, crLabel, xpLabel) {
  const crGiven = record.cr_given  === true;
  const xpGiven = record.xp_given  === true;
  const hasCR   = record.cr  != null;
  const hasXP   = record.xp  != null;
  const mismat  = record.cr_xp_mismatch === true;

  const cr = hasCR ? formatCRValue(record.cr) : null;
  const xp = hasXP ? record.xp.toLocaleString() : null;

  if (!hasCR && !hasXP) {
    return `<strong>${crLabel}</strong> —`;
  }

  if (hasCR && crGiven && hasXP && !xpGiven) {
    // CR given, XP derived
    return `<strong>${crLabel}</strong> ${cr}${FLAG_GIVEN} (${xp} ${xpLabel}${FLAG_DERIVED})`;
  }

  if (hasXP && xpGiven && hasCR && !crGiven) {
    // XP given, CR derived
    return `<strong>${xpLabel}</strong> ${xp}${FLAG_GIVEN} (${crLabel} ${cr}${FLAG_DERIVED})`;
  }

  if (hasCR && crGiven && hasXP && xpGiven && !mismat) {
    // Both given, aligned
    return `<strong>${crLabel}</strong> ${cr}${FLAG_GIVEN} (${xp} ${xpLabel}${FLAG_GIVEN})`;
  }

  if (hasCR && crGiven && hasXP && xpGiven && mismat) {
    // Both given, misaligned
    return `<strong>${crLabel}</strong> ${cr}${FLAG_GIVEN} (${xp} ${xpLabel}${FLAG_GIVEN}) ${FLAG_MISMATCH}`;
  }

  // Defensive: bad data
  return `<strong>${xpLabel}</strong> ${xp}${FLAG_DERIVED}`;
}
