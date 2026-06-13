/* ---------------------------------------------------------
Path: runtime/js/formatters/formatter-monster.js
File: formatter-monster.js
Version: V2.1
Data Schema: V1.1
System: D&D Reference System – Reference System Runtime (RSR)
Module/Role: Monster-specific field formatters for runtime field resolution. Registered into the centralized formatter registry in formatter-common.js. Consumed by template-driven renderers via format keys in template field definitions.
Dependencies:
  - runtime/js/formatters/formatter-common.js
Created: 2026-03-25
Last Updated: 2026-04-25
Author: Bruce Pilcher
Changelog:
  V2.2:
  - formatAbilityScores rewritten to return HTML;
    two-column grid, three abilities per column,
    STR/DEX/CON left, INT/WIS/CHA right.
    Abbreviations in red, score (modifier) in value color.
    Modifier always signed except zero which shows as 0.
    Now an HTML-producing formatter — registered in
    card-renderer.js HTML_FORMATTERS set.
  V2.1:
  - formatSpeed rewritten to match stat-block behaviour: walk label suppressed, other modes lowercase, hover rendered as bare "hover" with no distance
  - Added formatSenses: senses object to comma-separated string; passive_perception rendered as "passive Perception N"
  - Added formatLanguages: languages array to comma-separated string
  - Registry updated with senses and languages keys
  V2.0: Added formatters for structured object fields used by the monster entity card template: - abilityScores: { str, dex, con, int, wis, cha } → stat line - speed: { walk, fly, swim, ... } → comma-separated string Removed formatSizeType (size_type is not a real data field). Keys: "cr", "abilityScores", "speed"
  V1.3: Path corrected from fieldFormatters/ to formatters/
  V1.2: Header updated to full File Header Contract compliance
  V1.1: Removed shared formatters; kept only domain-specific monster formatters
Related Files:
  runtime/js/formatters/formatter-common.js
  runtime/js/templates/monsters/entity/card.js
Notes:
  - All formatters respect Field Resolution Semantics via safeFormat
  - abilityScores expects { str, dex, con, int, wis, cha }; missing keys render as "-"
  - speed expects { walk: "30 ft.", fly: "60 ft." } etc.; keys are capitalized in output
  - armor_type and hit_dice are plain strings — no formatter needed; they are suppressed naturally when empty by the renderer
--------------------------------------------------------- */

import { safeFormat, isEmpty } from "./formatter-common.js";

/* ---------------------------------------------------------
   Challenge Rating
--------------------------------------------------------- */

/**
 * Format CR (Challenge Rating).
 * Numeric or string value passed through as string.
 */
export const formatCR = safeFormat((value) => {
  if (isEmpty(value)) return "";
  return typeof value === "number" ? value.toString() : String(value);
});

/* ---------------------------------------------------------
   Ability Scores
--------------------------------------------------------- */

/**
 * Format the six ability scores as a readable stat line.
 * Expects { str, dex, con, int, wis, cha } — Schema V1.1 canonical shape.
 * Missing keys render as "-".
 */
export const formatAbilityScores = safeFormat((value) => {
  if (!value || typeof value !== "object") return "";

  const abilities = [
    ["STR", "str"],
    ["DEX", "dex"],
    ["CON", "con"],
    ["INT", "int"],
    ["WIS", "wis"],
    ["CHA", "cha"]
  ];

  const mod = score => {
    const m = Math.floor((score - 10) / 2);
    return m > 0 ? `+${m}` : String(m);
  };

  const left  = abilities.slice(0, 3);
  const right = abilities.slice(3);

  const rows = left.map(([ abbr, key ], i) => {
    const [ rAbbr, rKey ] = right[i];
    const lScore = value[key]  ?? 10;
    const rScore = value[rKey] ?? 10;
    const lMod   = mod(lScore);
    const rMod   = mod(rScore);
    return `
      <div class="ability-row">
        <span class="ability-abbr">${abbr}</span>
        <span class="ability-value">${lScore} (${lMod})</span>
        <span class="ability-abbr">${rAbbr}</span>
        <span class="ability-value">${rScore} (${rMod})</span>
      </div>`;
  }).join("\n");

  return `<div class="card-ability-grid">${rows}</div>`;
});

/* ---------------------------------------------------------
   Speed
--------------------------------------------------------- */

/**
 * Format speed object as a comma-separated string.
 * Walk label suppressed; other modes shown lowercase before value.
 * hover: true rendered as bare "hover" with no distance.
 * e.g. { walk: "10 ft.", swim: "40 ft." } -> "10 ft., swim 40 ft."
 * e.g. { walk: "50 ft.", fly: "50 ft.", hover: true } -> "50 ft., fly 50 ft., hover"
 */
export const formatSpeed = safeFormat((value) => {
  if (!value || typeof value !== "object") return String(value);
  const entries = Object.entries(value);
  if (entries.length === 0) return "";
  return entries
    .map(([mode, val]) => {
      if (mode === "walk")  return val;
      if (mode === "hover") return "hover";
      return `${mode} ${val}`;
    })
    .join(", ");
});
/* ---------------------------------------------------------
   Senses
--------------------------------------------------------- */
/**
 * Format senses object as a comma-separated string.
 * passive_perception rendered as "passive Perception N".
 * Other keys rendered as "darkvision 120 ft." etc.
 */
export const formatSenses = safeFormat((value) => {
  if (!value || typeof value !== "object") return String(value);
  const parts = [];
  for (const [key, val] of Object.entries(value)) {
    if (key === "passive_perception") {
      parts.push(`passive Perception ${val}`);
    } else {
      const label = key.replace(/_/g, " ");
      parts.push(`${label} ${val}`);
    }
  }
  return parts.join(", ");
});
/* ---------------------------------------------------------
   Languages
--------------------------------------------------------- */
/**
 * Format languages array as a comma-separated string.
 */
export const formatLanguages = safeFormat((value) => {
  if (!Array.isArray(value)) return String(value);
  return value.join(", ");
});
/* ---------------------------------------------------------
   Monster Formatter Registry
   Merged into the centralized registry in formatter-common.js.
--------------------------------------------------------- */

export const monsterFormatters = {
  cr:            formatCR,
  abilityScores: formatAbilityScores,
  speed:         formatSpeed,
  senses:        formatSenses,
  languages:     formatLanguages,
};