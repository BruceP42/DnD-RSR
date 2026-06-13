/* --------------------------------------------------------- */
// Path:         runtime/js/formatters/formatter-magic-item.js
// File:         formatter-magic-item.js
// Version:      V1.0
// Data Schema:  V1.1
// System:       RSR (D&D Reference System)
// Module/Role:  Magic-item-specific formatter definitions
// Dependencies: none
// Created:      2026-04-11
// Last Updated: 2026-04-11
/* --------------------------------------------------------- */

export const magicItemFormatters = {

  rarity(value) {
    if (!value || typeof value !== "string") return "";
    return value.charAt(0).toUpperCase() + value.slice(1);
  },

  attunement(value) {
    return value === true ? "Required" : "No";
  },

  attunementRestrictions(value) {
    if (!Array.isArray(value) || value.length === 0) return "";
    return value.join(", ");
  },

  itemCategory(value) {
    if (!value || typeof value !== "string") return "";
    return value.charAt(0).toUpperCase() + value.slice(1);
  },

};
