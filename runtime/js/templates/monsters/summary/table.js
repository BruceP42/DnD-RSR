/* ---------------------------------------------------------
Path: runtime/js/templates/monsters/summary/table.js
File: table.js
Version: V3.0
Data Schema: V1.1
System: D&D Reference System – Reference System Runtime (RSR)
Module/Role: Monster summary table template; defines column
  structure for the monsters summary table view. Consumed by
  table-renderer.js via the template registry resolution chain.
  Filter bar config consumed by filter-utils.js renderFilterBar().
Dependencies: None
Created: 2026
Last Updated: 2026-04-12
Author: Bruce Pilcher
Changelog:
  V3.0:
    - Added filters array for filter bar configuration
    - name: filterType "text" for substring search
    - creature_type: filterType "select", unique values from dataset
    - size: filterType "select", unique values from dataset
    - ac: filterType "range" — renders min/max number inputs
    - cr: filterType "range" — renders min/max number inputs
  V2.0:
    - Rewritten to match current template contract (columns array
      at top level). cr and xp split into separate columns.
      format key maps to formatter-common.js registry.
  V1.0: Initial release
Related Files:
  runtime/js/templates/monsters/registry.js
  runtime/js/renderers/table-renderer.js
  runtime/js/formatters/formatter-common.js
  runtime/js/formatters/formatter-monster.js
  runtime/js/_core/filter-utils.js
Notes:
  - columns array drives table-renderer.js (display)
  - filters array drives filter-utils.js (filter bar UI)
  - Range filters produce { min?, max? } objects in viewState.filter
    and filter_<field>_min / filter_<field>_max in the URL
  - ac and cr range inputs accept decimal values (cr can be
    0.125, 0.25, 0.5 etc.)
--------------------------------------------------------- */

export const monstersTableTemplate = {

  columns: [
    { field: "name",          label: "Name",      sortable: true  },
    { field: "creature_type", label: "Type",      sortable: true  },
    { field: "size",          label: "Size",      sortable: true  },
    { field: "alignment",     label: "Alignment", sortable: false },
    { field: "ac",            label: "AC",        sortable: true  },
    { field: "hp",            label: "HP",        sortable: true  },
    { field: "cr",            label: "CR",        sortable: true,  format: "cr" },
    { field: "xp",            label: "XP",        sortable: true  }
  ],

  filters: [
    {
      field:      "name",
      label:      "Name",
      filterType: "text"
    },
    {
      field:      "creature_type",
      label:      "Type",
      filterType: "select"
    },
    {
      field:      "size",
      label:      "Size",
      filterType: "select"
    },
    {
      field:      "ac",
      label:      "AC",
      filterType: "range"
    },
    {
      field:      "cr",
      label:      "CR",
      filterType: "range"
    }
  ]

};
