/* ---------------------------------------------------------
Path: runtime/js/formatters/formatter-spell.js
File: formatter-spell.js
Version: V1.3
Data Schema: V1.1
System: D&D Reference System – Reference System Runtime (RSR)
Module/Role: Spell-specific field formatters for runtime field resolution. Registered into the centralized formatter registry in formatter-common.js. Consumed by template-driven renderers via format keys in template field definitions.
Dependencies:
  - runtime/js/formatters/formatter-common.js
Created: 2026-03-25
Last Updated: 2026-04-10
Author: Bruce Pilcher
Changelog:
  V1.1: Removed shared formatters; kept only domain-specific spell formatters
  V1.2: Header updated to full File Header Contract compliance
  V1.3: Added formatMaterial (nullable string — returns empty string when absent, so field is suppressed by the renderer). Registry key: "material".
Related Files:
  runtime/js/formatters/formatter-common.js
  runtime/js/templates/spells/entity/card.js
Notes:
  - All formatters respect Field Resolution Semantics via safeFormat
  - formatMaterial returns "" when value is null/undefined/empty — renderer omits the field row entirely in that case
  - spellLevel: 0 → "Cantrip"; otherwise ordinal suffix (1st, 2nd…)
--------------------------------------------------------- */

import { safeFormat } from "./formatter-common.js";

/* ---------------------------------------------------------
   Spell Level
--------------------------------------------------------- */

/**
 * Format spell level.
 * 0 → "Cantrip"; 1–9 → "1st level", "2nd level", etc.
 */
export const formatSpellLevel = safeFormat((value) => {
  if (value === 0) return "Cantrip";
  const suffix =
    value === 1 ? "st" :
    value === 2 ? "nd" :
    value === 3 ? "rd" : "th";
  return `${value}${suffix} level`;
});

/* ---------------------------------------------------------
   Material Component
--------------------------------------------------------- */

/**
 * Format material component text.
 * Returns the string as-is when present; safeFormat returns ""
 * when the value is null, undefined, or empty — so the renderer
 * suppresses the field row without any conditional logic here.
 */
export const formatMaterial = safeFormat((value) => String(value));

/* ---------------------------------------------------------
   Spell Formatter Registry
   Merged into the centralized registry in formatter-common.js.
--------------------------------------------------------- */

export const spellFormatters = {
  spellLevel: formatSpellLevel,
  material:   formatMaterial
};