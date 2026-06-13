/* ---------------------------------------------------------
Path: runtime/js/renderers/table-renderer.js
File: table-renderer.js
Version: V4.1
Data Schema: V1.1
System: D&D Reference System – Reference System Runtime (RSR)
Module/Role:
  - Generic template-driven table renderer; converts a column-definition template and dataset into HTML table output.
  - Domain-agnostic — all column and format intent comes from the template.
Dependencies:
  - runtime/js/formatters/formatter-common.js
Created: 2026-03-21
Last Updated: 2026-04-12
Author: Bruce Pilcher
Changelog:
  V1.0: Initial basic table renderer
  V2.0: Simplified; moved toward template-driven model
  V3.0: Aligned with Renderer Contract V1.2; added data-record-id attribute support for shell-level row interaction
  V3.1: Introduced data-record-id for table-interaction-controller
  V4.0: 
    - Fully template-driven. Columns now read from template.columns — no hardcoded fields remain.
    - format keys resolved against formatter-common.js registry. 
    - sortable flag carried on <th> as data-sortable attribute for future sort UI wiring.
    - paragraphs formatter produces HTML — rendered raw via data-raw-html attribute pattern is NOT used in tables; arrays fall back to plain join for table cell safety.
  V4.1: 
    - Added class="unified-table" to <table> element for CSS targeting. Added data-field attribute to sortable <th> elements so sort-utils.js can read the field name on click.
    - Added <span class="sort-indicator"></span> inside sortable <th> elements for CSS ::after sort arrow indicators.
Related Files:
  - runtime/js/renderers/table-renderer.js (this file)
  - runtime/js/templates/spells/summary/table.js
  - runtime/js/templates/monsters/summary/table.js
  - runtime/js/formatters/formatter-common.js
  - runtime/js/_core/sort-utils.js
  - runtime/js/_core/table-interaction-controller.js
Notes:
  - Domain-agnostic: zero domain knowledge in this file
  - All column definitions come from template.columns
  - format key in column def maps to formatter-common.js registry
  - Missing format key → String(value) fallback
  - Missing or empty value → empty string (cell left blank)
  - record.id is required — throws if absent (identity contract)
  - data-sortable and data-field on <th> are consumed by sort-utils.js bindTableSortClicks()
  - .sort-indicator span is targeted by unified-renderer.css ::after rules for ▲/▼ arrow display
  - HTML-producing formatters (paragraphs) are safe for card use but intentionally not used in table column definitions — table cells should carry plain text only
--------------------------------------------------------- */

import { formatters } from "../formatters/formatter-common.js";

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
 * @returns {string}
 */
function resolveCell(record, field, format) {
  const value = record?.[field];

  if (value === null || value === undefined || value === "") return "";

  if (format && formatters[format]) {
    return formatters[format](value);
  }

  // Array fallback for table cells — join rather than produce HTML
  if (Array.isArray(value)) return value.join(", ");

  return String(value);
}

/* ---------------------------------------------------------
   Table Renderer
--------------------------------------------------------- */

export const tableRenderer = {

  /**
   * Render a dataset as an HTML table driven by template.columns.
   *
   * @param {Object}   params
   * @param {Array}    params.data     - Array<Record> from engine
   * @param {Object}   params.template - template object with columns array
   * @returns {string} HTML string
   */
  render({ data, template }) {

    // --- Validate data
    if (!Array.isArray(data)) {
      throw new Error("[tableRenderer] data must be an array");
    }

    // --- Validate template
    if (!template || !Array.isArray(template.columns) || template.columns.length === 0) {
      throw new Error("[tableRenderer] template must define a non-empty columns array");
    }

    const columns = template.columns;

    // --- Header row
    const headerCells = columns
      .map(col => {
        if (col.sortable) {
          return `<th data-sortable="true" data-field="${col.field}">${col.label ?? col.field}<span class="sort-indicator"></span></th>`;
        }
        return `<th>${col.label ?? col.field}</th>`;
      })
      .join("");

    const thead = `<thead><tr>${headerCells}</tr></thead>`;

    // --- Body rows
    const rows = data.map(record => {
      if (!record.id) {
        throw new Error("[tableRenderer] record.id is required (identity contract)");
      }

      const cells = columns
        .map(col => {
          const value = resolveCell(record, col.field, col.format);
          return `<td>${value}</td>`;
        })
        .join("");

      return `<tr data-record-id="${record.id}">${cells}</tr>`;
    }).join("");

    const tbody = `<tbody>${rows}</tbody>`;

    return `<table class="unified-table">${thead}${tbody}</table>`;
  }

};
