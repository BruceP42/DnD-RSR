/* ---------------------------------------------------------
Path: runtime/js/renderers/card-renderer.js
File: card-renderer.js
Version: V2.6
Data Schema: V1.1
System: D&D Reference System - Reference System Runtime (RSR)
Module/Role:
  Generic template-driven card renderer; converts a section/field
  template and a single entity record into an HTML card.
  Domain-agnostic — all section structure, field selection, and
  formatting intent comes from the template.
Dependencies:
  - runtime/js/formatters/formatter-common.js
Created: 2026-03-31
Last Updated: 2026-05-21
Author: Bruce Pilcher
Changelog:
  V2.6:
  - Added nodeType "badges" handler. Reads section.badges array;  each entry: { field, class, title, label? }. Emits a  .spell-icons div containing a .icon span per truthy field.  label is optional text content (used for text-based badges  such as attunement "A"; image-based badges leave it empty).
  V2.5:
  - Added "abilityScores" to HTML_FORMATTERS set
  V2.4:
  - Import updated to add renderCreatureMeta, renderArmorClass, renderHitPoints, renderCRXP from render-helpers.js
  - Added nodeType handlers: creature-meta, armor-class, hit-points, cr-xp
  V2.3:
  - Added renderSources import from ./render-helpers.js
  - Footer always rendered (previously conditional on buttons)
  - card-footer-left renamed to card-footer-actions
  - card-footer-right renamed to card-footer-sources
  - Sources rendered into card-footer-sources via renderSources()
  - Buttons rendered into card-footer-actions (empty when no buttons defined in template)
  V2.2:
  - Fixed data-domain attribute on .card root element; was incorrectly set to record.id, now correctly set to domain string parsed from template.type.split(".")[0] (e.g. "monsters", "spells", "magic-items"). Required for domain-specific CSS selectors to work.
  V2.1:
  - Renders template.buttons array into .card-footer-right
  - Each button emits <button class="..." data-action="..."  data-id="record.id"> with label as text content
  - .card-footer wrapper always rendered when buttons present;  .card-footer-left reserved for future source attribution
  - record.id used as data-id so controller delegation can read  the target monster without querying viewState
  V2.0: 
  - Fully template-driven (Model C). Formatters resolved from formatter-common.js registry via format key in field defs. label: null suppresses label element. HTML-producing formatters rendered raw. Field rows with empty formatted values suppressed.
  V1.1:
  -  Deterministic template -> card HTML transformation; section/field iteration; defensive handling.
  V1.0: 
  - Initial card renderer; generic key/value section rendering.
Related Files:
  runtime/js/templates/spells/entity/card.js
  runtime/js/templates/monsters/entity/card.js
  runtime/js/formatters/formatter-common.js
  runtime/js/renderers/table-renderer.js
Notes:
  - Domain-agnostic: zero domain knowledge in this file
  - All section and field structure comes from template.sections
  - format key maps to formatter-common.js registry; missing key falls back to String(value)
  - Fields whose formatted value is "" are omitted from output
  - label: null renders value without a label element
  - paragraphs formatter returns HTML string — inserted raw
  - template.buttons is optional; omit for domains with no buttons
  - Sections with no visible fields still render their wrapper
  - Condition system (ritual/concentration badges) deferred
--------------------------------------------------------- */

import { formatters } from "../formatters/formatter-common.js";
import { renderSources, renderCreatureMeta, renderArmorClass, renderHitPoints, renderCRXP } from "./render-helpers.js";

/* ---------------------------------------------------------
   HTML-Producing Formatters
   These return HTML strings and must be inserted raw, not escaped.
--------------------------------------------------------- */
const HTML_FORMATTERS = new Set(["paragraphs", "sourceBlock", "abilityScores"]);

/* ---------------------------------------------------------
   Value Resolution
--------------------------------------------------------- */

/**
 * Resolve a field value from a record, applying a formatter if specified.
 * Returns empty string for null/undefined/empty values.
 *
 * @param {Object} record   - data record
 * @param {string} field    - field name
 * @param {string} [format] - optional formatter key
 * @returns {{ value: string, isHTML: boolean }}
 */
function resolveField(record, field, format) {
  const raw = record?.[field];

  if (raw === null || raw === undefined || raw === "") {
    return { value: "", isHTML: false };
  }

  if (format && formatters[format]) {
    return {
      value:  formatters[format](raw),
      isHTML: HTML_FORMATTERS.has(format)
    };
  }

  if (Array.isArray(raw)) {
    return { value: raw.join(", "), isHTML: false };
  }

  return { value: String(raw), isHTML: false };
}

/* ---------------------------------------------------------
   Card Renderer
--------------------------------------------------------- */

export const cardRenderer = {

  /**
   * Render a single entity record as an HTML card driven by
   * template.sections (and optional template.buttons).
   *
   * @param {Object} params
   * @param {Array}  params.data     - Array<Record>; only first record used
   * @param {Object} params.template - template object with sections array
   * @returns {string} HTML string
   */
  render({ data, template }) {

    // --- Validate data
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error("[cardRenderer] data must be a non-empty array");
    }

    // --- Validate template
    if (!template || !Array.isArray(template.sections)) {
      throw new Error("[cardRenderer] template must define a sections array");
    }

    const record   = data[0];
    const domain   = (template.type ?? "").split(".")[0];
    const sections = template.sections;

    // --- Render sections
    const sectionsHTML = sections.map(section => {
      // creature-meta: size, type, subtype, alignment on one line
      if (section.nodeType === "creature-meta") {
        const meta = renderCreatureMeta(record);
        if (!meta) return "";
        return `
          <div class="card-section" data-section="creature-meta">
            <div class="card-creature-meta">${meta}</div>
          </div>
        `;
      }
      
      // armor-class: ac (armor type)
      if (section.nodeType === "armor-class") {
        const ac = renderArmorClass(record);
        if (!ac) return "";
        return `
          <div class="card-section" data-section="armor-class">
            <div class="card-field" data-field="ac">
              <span class="card-field-label">AC</span>
              <span class="card-field-value">${ac}</span>
            </div>
          </div>
        `;
      }
      
      // hit-points: hp (hit dice)
      if (section.nodeType === "hit-points") {
        const hp = renderHitPoints(record);
        if (!hp) return "";
        return `
          <div class="card-section" data-section="hit-points">
            <div class="card-field" data-field="hp">
              <span class="card-field-label">HP</span>
              <span class="card-field-value">${hp}</span>
            </div>
          </div>
        `;
      }
      
      // cr-xp: challenge rating and experience points
      if (section.nodeType === "cr-xp") {
        const html = renderCRXP(record, "CR", "XP");
        if (!html) return "";
        return `
          <div class="card-section" data-section="cr-xp">
            <div class="card-field" data-field="cr">
              <span class="card-field-label">Challenge</span>
              <span class="card-field-value">${html}</span>
            </div>
          </div>
        `;
      }

      // badges: render active boolean fields as .icon spans inside .spell-icons
      if (section.nodeType === "badges") {
        const activeBadges = (section.badges ?? [])
          .filter(b => !!record[b.field])
          .map(b => `<span class="icon ${b.class}" title="${b.title}">${b.label ?? ""}</span>`)
          .join("");
        if (!activeBadges) return "";
        return `<div class="spell-icons">${activeBadges}</div>`;
      }

      const fieldsHTML = (section.fields ?? [])
        .map(fieldDef => {
          const { value, isHTML } = resolveField(record, fieldDef.field, fieldDef.format);

          // Suppress field row if value is empty
          if (value === "") return "";

          const labelHTML = fieldDef.label != null
            ? `<span class="card-field-label">${fieldDef.label}</span>`
            : "";

          const valueHTML = isHTML
            ? `<div class="card-field-value card-field-html">${value}</div>`
            : `<span class="card-field-value">${value}</span>`;

          return `
            <div class="card-field" data-field="${fieldDef.field}">
              ${labelHTML}${valueHTML}
            </div>
          `;
        })
        .filter(Boolean)
        .join("");

      return `
        <div class="card-section" data-section="${section.id ?? "default"}">
          ${fieldsHTML}
        </div>
      `;
    }).join("");

    // --- Render footer (buttons)
    const buttons  = template.buttons ?? [];
    const recordId = record.id ?? "";
      const actionsHTML = buttons.map(btn => {
        const cls = btn.class ? ` class="${btn.class}"` : "";
        return `<button${cls} data-action="${btn.action}" data-id="${recordId}">${btn.label}</button>`;
      }).join("\n            ");
      
      const sourcesHTML = renderSources(record.sources ?? []);
      
      const footerHTML = `
        <div class="card-footer">
          <div class="card-footer-actions">${actionsHTML}</div>
          <div class="card-footer-sources">${sourcesHTML}</div>
        </div>
      `;

    return `
      <div class="card" data-domain="${domain}">
        ${sectionsHTML}
        ${footerHTML}
      </div>
    `;
  }

};
