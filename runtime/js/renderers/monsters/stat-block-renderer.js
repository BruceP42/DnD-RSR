/* ---------------------------------------------------------
Path: runtime/js/renderers/monsters/stat-block-renderer.js
File: stat-block-renderer.js
Version: V2.2
Data Schema: V1.1
System: D&D Reference System - Reference System Runtime (RSR)
Module/Role: Stat-block renderer for the monsters domain;
  renders a single monster record as a full D&D 5e stat block
  using the monstersStatBlockTemplate section definitions.
  Consumed by the renderer registry and resolve-renderer.js.
Dependencies:
  - runtime/js/templates/monsters/entity/stat-block.js
    (template - consumed via registry, not imported directly)
Created: 2026
Last Updated: 2026-06-09
Author: Bruce Pilcher
Changelog:
  V2.2:
    - renderActionList: action.name converted to title case for display;
      data remains as-is (pipeline convention — display case applied at
      render time, not stored in data).
  V2.1:
    - renderActionList: suppress action block entirely when both name
      and desc are absent or empty. When name is absent but desc is
      present, render desc as a plain paragraph with no item-name span
      or trailing period, avoiding a bare "." artefact.
  V2.0:
  - Removed private formatSpeed, formatSenses — now imported from formatter-monster.js via shared registry
  - Removed private formatCR, flag, FLAG_GIVEN, FLAG_DERIVED, FLAG_MISMATCH — now internal to render-helpers.js
  - renderHeader: inline meta logic replaced with renderCreatureMeta() from render-helpers.js
  - renderDefences: inline ac and hp logic replaced with renderArmorClass() and renderHitPoints() from render-helpers.js
  - renderSensesLanguages: six-case CR/XP matrix replaced with renderCRXP(record, "Challenge", "Experience Points")
  - Import updated to add renderCreatureMeta, renderArmorClass, renderHitPoints, renderCRXP from render-helpers.js
  - Import added for formatSpeed, formatSenses from formatter-monster.js
  V1.9:
    - Merged V1.7 changes (title case name, divider after h3)
      that were missing from V1.8 due to being edited directly
      in Notepad++ rather than produced here
  V1.8:
    - renderSources extracted to render-helpers.js as shared
      function; private renderSources replaced with thin wrapper
      renderSourcesBlock() that unwraps record.sources
    - Sources now rendered as .source-list div with one <p> per
      source, right-aligned block, left-aligned text within
    - Import added for renderSources from ../render-helpers.js
  V1.7:
    - renderHeader: monster name converted to title case for
      display; data remains lowercase (pipeline convention)
  V1.6:
    - renderActionList: divider added after each section h3
      replacing the border-bottom previously on .stat-block h3
      (border-bottom removed from CSS in unified-renderer.css)
  V1.5:
    - formatSpeed rewritten: walk label suppressed, other modes
      shown lowercase before value, hover (boolean true) rendered
      as bare "hover" with no distance
      e.g. { walk: "10 ft.", swim: "40 ft." } -> "10 ft., swim 40 ft."
      e.g. { walk: "50 ft.", fly: "50 ft.", hover: true } -> "50 ft., fly 50 ft., hover"
  V1.4:
    - CR/XP display matrix finalised with per-value provenance flags:
        † (dagger)  source-given value, <sup> superscript
        ≈ (approx)  derived/calculated value, <sup> superscript
        ⚠ (warning) CR and XP both given but do not align, normal size
      Case matrix:
        CR given, XP derived:
          Challenge 10 <sup>†</sup> (5,900 XP <sup>≈</sup>)
        XP given, CR derived:
          Experience Points 5,900 <sup>†</sup> (CR 1 <sup>≈</sup>)
        Both given, aligned:
          Challenge 10 <sup>†</sup> (5,900 XP <sup>†</sup>)
        Both given, misaligned:
          Challenge 10 <sup>†</sup> (5,900 XP <sup>†</sup>) ⚠
        Neither:
          Challenge —
        Defensive (bad data — cr_given: false, xp derived):
          Experience Points X <sup>≈</sup>
    - All flags carry native title tooltip; styled CSS tooltip deferred
    - <sup> used for superscript; .flag CSS class deferred to same
      future session as styled tooltip
    - Display labels: "Challenge" and "Experience Points" (full words,
      title case); secondary labels "XP" and "CR" (uppercase)
  V1.3:
    - Five-case CR/XP logic using cr_given, xp_given, cr_xp_mismatch
  V1.2:
    - Full implementation replacing V1.1 stub
  V1.1: Corrected renderer contract; documented nodeType contract
  V1.0: Initial stub release
Related Files:
  runtime/js/renderers/monsters/registry.js
  runtime/js/templates/monsters/entity/stat-block.js
  runtime/js/resolve-renderer.js
Notes:
  - render({ data, template }) contract: data is Array,
    template is plain object (NOT a function)
  - data[0] is the single monster record
  - All CSS classes used here are defined in unified-renderer.css
  - CR formatting: fractions displayed as 1/8, 1/4, 1/2 for
    0.125, 0.25, 0.5; integers shown as-is
  - The header section is identified by section.id === "header"
    and rendered as h2 + em rather than generic field rows
  - The defences section is identified by section.id === "defences"
    and rendered as compact combined paragraphs
  - The senses-languages section is identified by
    section.id === "senses-languages" and receives type-aware
    rendering for its mixed-type fields
  - CR/XP rendering driven by cr_given, xp_given, cr_xp_mismatch
    flags on the record — see V1.4 changelog for full case matrix
  - American spelling throughout (color not colour)
--------------------------------------------------------- */

import { renderSources, renderCreatureMeta, renderArmorClass, renderHitPoints, renderCRXP } from "../render-helpers.js";
import { formatSpeed, formatSenses } from "../../formatters/formatter-monster.js";
// ----------------------------
// Helpers
// ----------------------------

/** Compute ability modifier from score. */
function abilityMod(score) {
  const mod = Math.floor((score - 10) / 2);
  return mod >= 0 ? `+${mod}` : String(mod);
}

/** True if value is absent, null, empty string, or empty array/object. */
function isEmpty(value) {
  if (value === null || value === undefined || value === "") return true;
  if (Array.isArray(value))      return value.length === 0;
  if (typeof value === "object") return Object.keys(value).length === 0;
  return false;
}

/**
 * Render an object of stat bonuses (saving_throws, skills) as a string.
 * Keys are ability/skill names; values are numeric bonuses.
 * { str: 3, wis: 2 } -> "Str +3, Wis +2"
 */
function formatBonusObject(obj) {
  return Object.entries(obj)
    .map(([key, value]) => {
      const label = key.charAt(0).toUpperCase() + key.slice(1);
      const bonus = Number(value) >= 0 ? `+${value}` : String(value);
      return `${label} ${bonus}`;
    })
    .join(", ");
}

/**
 * Render an array of damage type objects or plain strings.
 * Each entry may be a string or { name, ... }.
 */
function formatArray(arr) {
  return arr
    .map(item => {
      if (typeof item === "string") return item;
      if (item && item.name) return item.name;
      return JSON.stringify(item);
    })
    .join(", ");
}

// ----------------------------
// Section renderers
// ----------------------------

/**
 * Render the header section (id: "header") as:
 *   <h2>Name</h2>
 *   <em>Size CreatureType (subtype), Alignment</em>
 * Plus a divider.
 */
function renderHeader(record) {
  const name = (record.name ?? "Unknown")
    .replace(/\b\w/g, c => c.toUpperCase());
  const meta = renderCreatureMeta(record);

  return `<h2>${name}</h2>
<em>${meta}</em>
<div class="divider"></div>`;
}

/**
 * Render the defences section (id: "defences") as compact
 * labelled paragraphs, combining ac+armor_type and hp+hit_dice.
 */
function renderDefences(record) {
  const parts = [];
  
  // Armor Class
  const acPart = renderArmorClass(record);
  if (acPart) {
    parts.push(`<p><strong>Armor Class</strong> ${acPart}</p>`);
  }
  
  // Hit Points
  const hpPart = renderHitPoints(record);
  if (hpPart) {
    parts.push(`<p><strong>Hit Points</strong> ${hpPart}</p>`);
  }
  
  // Speed
  if (!isEmpty(record.speed)) {
    parts.push(`<p><strong>Speed</strong> ${formatSpeed(record.speed)}</p>`);
  }
  return parts.join("\n") + '\n<div class="divider"></div>';
}

/**
 * Render the ability-grid section.
 * Six columns: STR DEX CON INT WIS CHA
 */
function renderAbilityGrid(record) {
  const scores    = record.ability_scores ?? {};
  const abilities = [
    { abbr: "STR", key: "str" },
    { abbr: "DEX", key: "dex" },
    { abbr: "CON", key: "con" },
    { abbr: "INT", key: "int" },
    { abbr: "WIS", key: "wis" },
    { abbr: "CHA", key: "cha" }
  ];

  const cells = abilities.map(({ abbr, key }) => {
    const score = scores[key] ?? 10;
    const mod   = abilityMod(score);
    return `<div class="ability">
  <div class="abbr">${abbr}</div>
  <div class="score">${score}</div>
  <div class="mod">${mod}</div>
</div>`;
  }).join("\n");

  return `<div class="stat-block-abilities">\n${cells}\n</div>`;
}

/**
 * Render a stat-list section (combat-stats).
 * Skips the entire section if optional and all fields are empty.
 * Skips individual rows whose value is empty.
 */
function renderStatList(section, record) {
  const rows = [];

  for (const fieldDef of section.fields) {
    const value = record[fieldDef.field];
    if (isEmpty(value)) continue;

    let rendered;
    if (Array.isArray(value)) {
      rendered = formatArray(value);
    } else if (typeof value === "object") {
      rendered = formatBonusObject(value);
    } else {
      rendered = String(value);
    }

    rows.push(`<p><strong>${fieldDef.label}</strong> ${rendered}</p>`);
  }

  if (rows.length === 0 && section.optional) return "";

  return rows.join("\n");
}

/**
 * Render the senses-languages section (id: "senses-languages").
 * Each field receives type-aware rendering.
 * CR/XP handled via the full six-case matrix using cr_given,
 * xp_given, and cr_xp_mismatch flags on the record.
 */
function renderSensesLanguages(section, record) {
  const rows = [];

  for (const fieldDef of section.fields) {
    const value = record[fieldDef.field];

    if (fieldDef.field === "senses") {
      if (!isEmpty(value)) {
        rows.push(`<p><strong>Senses</strong> ${formatSenses(value)}</p>`);
      }
      continue;
    }

    if (fieldDef.field === "languages") {
      if (!isEmpty(value)) {
        const langStr = Array.isArray(value) ? value.join(", ") : String(value);
        rows.push(`<p><strong>Languages</strong> ${langStr}</p>`);
      }
      continue;
    }

    if (fieldDef.field === "cr") {
      const html = renderCRXP(record, "Challenge", "Experience Points");
      rows.push(`<p>${html}</p>`);
      continue;
    }

    // Skip xp — rendered inline with cr above
    if (fieldDef.field === "xp") continue;

    // Fallback for any future field additions to this section
    if (!isEmpty(value)) {
      rows.push(`<p><strong>${fieldDef.label}</strong> ${value}</p>`);
    }
  }

  return rows.join("\n");
}

/**
 * Render an action-list section (traits, actions, reactions, etc.).
 * Skips the entire section if optional and source array is empty/absent.
 * Each action: item-name (bold inline) + item-description (inline).
 */
function renderActionList(section, record) {
  const items = record[section.source];
  if (isEmpty(items) && section.optional) return "";
  if (!Array.isArray(items) || items.length === 0) return "";

  const title = `<h3>${section.title}</h3>\n<div class="divider"></div>`;

  const itemHtml = items.map(action => {
    const name    = (action.name ?? "").replace(/\b\w/g, c => c.toUpperCase());
    const hasName = name.trim() !== "";

    if (Array.isArray(action.desc) && action.desc.length > 1) {
      // Multi-paragraph desc (split to-hit / damage)
      const firstDesc = action.desc[0] ?? "";
      const restDesc  = action.desc.slice(1).map(para => `<p>${para}</p>`).join("\n");
      if (hasName) {
        return `<div class="item">
<p><span class="item-name">${name}.</span> <span class="item-description">${firstDesc}</span></p>
${restDesc}
</div>`;
      } else {
        return `<div class="item">
<p><span class="item-description">${firstDesc}</span></p>
${restDesc}
</div>`;
      }
    } else {
      const desc    = Array.isArray(action.desc) ? (action.desc[0] ?? "") : (action.desc ?? "");
      const hasDesc = desc.trim() !== "";
      // Suppress entirely if both name and desc are empty
      if (!hasName && !hasDesc) return "";
      if (hasName) {
        return `<div class="item">
<p><span class="item-name">${name}.</span> <span class="item-description">${desc}</span></p>
</div>`;
      } else {
        // Desc present, name absent — render without item-name span or period
        return `<div class="item">
<p><span class="item-description">${desc}</span></p>
</div>`;
      }
    }
  }).filter(Boolean).join("\n");

  return `<div class="section">\n${title}\n${itemHtml}\n</div>`;
}

/**
 * Render the sources footer.
 * Delegates to shared renderSources() from render-helpers.js.
 * Unwraps record.sources so the helper receives the array directly.
 */
function renderSourcesBlock(record) {
  return renderSources(record.sources);
}

// ----------------------------
// Main renderer
// ----------------------------

export const statBlockRenderer = {
  render({ data, template }) {
    const record = Array.isArray(data) ? data[0] : data;
    if (!record) return `<div class="stat-block"><p>No data</p></div>`;

    const sections = template.sections ?? [];
    const parts    = [];

    for (const section of sections) {
      switch (section.nodeType) {

        case "fields": {
          if (section.id === "header") {
            parts.push(renderHeader(record));
          } else if (section.id === "defences") {
            parts.push(renderDefences(record));
          } else if (section.id === "senses-languages") {
            const html = renderSensesLanguages(section, record);
            if (html) parts.push(html);
          } else {
            // Generic fields fallback
            const rows = [];
            for (const fieldDef of (section.fields ?? [])) {
              const value = record[fieldDef.field];
              if (!isEmpty(value)) {
                rows.push(`<p><strong>${fieldDef.label}</strong> ${value}</p>`);
              }
            }
            if (rows.length > 0) parts.push(rows.join("\n"));
          }
          break;
        }

        case "ability-grid": {
          parts.push(renderAbilityGrid(record));
          break;
        }

        case "stat-list": {
          const html = renderStatList(section, record);
          if (html) parts.push(html);
          break;
        }

        case "action-list": {
          const html = renderActionList(section, record);
          if (html) parts.push(html);
          break;
        }

        default:
          break;
      }
    }

    parts.push(renderSourcesBlock(record));

    return `<div class="stat-block">\n${parts.filter(Boolean).join("\n")}\n</div>`;
  }
};
