/* ---------------------------------------------------------
Path: utils/crxp-helpers.js
File: crxp-helpers.js
Version: V1.0
Data Schema: V1.1
System: D&D Reference System – Data Pipeline V3
Module/Role: Utility functions for Challenge Rating (CR) and Experience Point (XP) conversion used during monster normalization and verification
Dependencies:
  - None (pure utility module)
Created: 2026-03-06
Last Updated: 2026-03-06
Author: Bruce Pilcher
Reviewed By: QA / System Lead
Changelog:
  V1.0
    - Initial CR ↔ XP conversion utilities
    - Implemented canonical SRD CR/XP lookup table
    - Added CR parsing and formatting helpers
Related Files:
  normalize/normalize-monsters.js
  verify/verify-monsters.js
Notes:
  - Provides canonical SRD CR ↔ XP mapping used by the normalization pipeline.
  - Used to derive XP from CR when XP is not present in raw datasets.
  - Also supports reverse lookup for validation and verification stages.
--------------------------------------------------------- */
// ========================================
// Canonical CR ↔ XP table (SRD / DMG)
// ========================================
const CR_XP_TABLE = {
  "0": 10,
  "1/8": 25,
  "1/4": 50,
  "1/2": 100,
  "1": 200,
  "2": 450,
  "3": 700,
  "4": 1100,
  "5": 1800,
  "6": 2300,
  "7": 2900,
  "8": 3900,
  "9": 5000,
  "10": 5900,
  "11": 7200,
  "12": 8400,
  "13": 10000,
  "14": 11500,
  "15": 13000,
  "16": 15000,
  "17": 18000,
  "18": 20000,
  "19": 22000,
  "20": 25000,
  "21": 33000,
  "22": 41000,
  "23": 50000,
  "24": 62000,
  "25": 75000,
  "26": 90000,
  "27": 105000,
  "28": 120000,
  "29": 135000,
  "30": 155000
};
// ========================================
// Convert CR → XP
// Input: numeric CR
// Output: XP number or null
// ========================================
export function getXPFromCR(cr) {
  const crKey = formatCR(cr);
  return CR_XP_TABLE[crKey] ?? null;
}
// ========================================
// Convert XP → CR
// Input: XP number
// Output: numeric CR
// ========================================
export function getCRFromXP(xp) {
  for (const [crKey, value] of Object.entries(CR_XP_TABLE)) {
    if (value === xp) {
      switch (crKey) {
        case "1/8": return 0.125;
        case "1/4": return 0.25;
        case "1/2": return 0.5;
        default: return Number(crKey);
      }
    }
  }
  return null;
}
// ========================================
// Format CR for display
// numeric → fractional string
// ========================================
export function formatCR(cr) {
  switch (cr) {
    case 0.125: return "1/8";
    case 0.25:  return "1/4";
    case 0.5:   return "1/2";
    default:    return String(cr);
  }
}
// ========================================
// Parse CR values
// Handles:
// "1/2", "1/4", "5", 5
// ========================================
export function parseCRValue(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  if (typeof value === "number") {
    return value;
  }
  const s = String(value).trim();
  if (s.includes("/")) {
    const [num, den] = s.split("/").map(Number);
    if (!isNaN(num) && !isNaN(den) && den > 0) {
      return num / den;
    }
  }
  const n = Number(s);
  return isNaN(n) ? null : n;
}