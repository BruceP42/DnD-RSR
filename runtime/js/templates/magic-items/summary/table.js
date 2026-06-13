/* ---------------------------------------------------------
Path: runtime/js/templates/magic-items/summary/table.js
File: table.js
Version: V2.1
Data Schema: V1.1
System: DnD-RSR — D&D 5e Dynamic Reference System
Module/Role:
 - Magic-items summary table template; defines column structure for the magic-items summary table view.
 - Consumed by table-renderer.js via the template registry resolution chain.
 - Filter bar config consumed by filter-utils.js renderFilterBar().
Dependencies: None
Created: 2026-04-11
Last Updated: 2026-06-07
Author: Bruce Pilcher
Changelog:
  V2.1:
    - Added useConfig: true to magic_item_category and rarity filter
      definitions. filter-utils.js reads domain-config.js for option
      values when this flag is set, preserving canonical config order
      rather than re-sorting from dataset scan.
  V2.0:
    - Added filters array for filter bar configuration
    - name: filterType "text" for substring search
    - magic_item_category: filterType "select", unique values from dataset
    - rarity: filterType "select", unique values from dataset
    - attunement: filterType "checkbox" (boolean field)
    - Normalized file header to block delimiter style
  V1.0: Initial implementation
Related Files:
  runtime/js/templates/magic-items/registry.js
  runtime/js/renderers/table-renderer.js
  runtime/js/formatters/formatter-common.js
  runtime/js/formatters/formatter-magic-item.js
  runtime/js/_core/filter-utils.js
  config/magic-items-config.json
Notes:
  - columns array drives table-renderer.js (display)
  - filters array drives filter-utils.js (filter bar UI)
  - attunement is boolean in the schema — checkbox filter sets
    filter_attunement=true in URL, coerced by reference-service.js
    BOOLEAN_FIELDS before engine query
  - useConfig: true — filter-utils.js loads option values from
    domain-config.js in canonical config order; no dataset scan
--------------------------------------------------------- */

export const tableTemplate = {
  type: "magic-items.summary.table",

  columns: [
    { field: "name",                label: "Name",       sortable: true  },
    { field: "magic_item_category", label: "Category",   sortable: true,  format: "itemCategory" },
    { field: "rarity",              label: "Rarity",     sortable: true,  format: "rarity"        },
    { field: "attunement",          label: "Attunement", sortable: false, format: "attunement"    },
    { field: "sources",             label: "Source",     sortable: false, format: "sourceList"    }
  ],

  filters: [
    {
      field:      "name",
      label:      "Name",
      filterType: "text"
    },
    {
      field:      "magic_item_category",
      label:      "Category",
      filterType: "select",
      useConfig:  true
    },
    {
      field:      "rarity",
      label:      "Rarity",
      filterType: "select",
      useConfig:  true
    },
    {
      field:      "attunement",
      label:      "Requires Attunement",
      filterType: "checkbox"
    }
  ]

};
