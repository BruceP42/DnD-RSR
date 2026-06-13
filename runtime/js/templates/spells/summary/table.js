/* ---------------------------------------------------------
Path: runtime/js/templates/spells/summary/table.js
File: table.js
Version: V3.0
Data Schema: V1.1
System: D&D Reference System – Reference System Runtime (RSR)
Module/Role: Spell summary table template; defines column structure
  for the spells summary table view. Consumed by table-renderer.js
  via the template registry resolution chain. Filter bar config
  consumed by filter-utils.js renderFilterBar().
Dependencies: None
Created: 2026-03-24
Last Updated: 2026-04-12
Author: Bruce Pilcher
Changelog:
  V3.0:
    - Added filterable flags to school, level, classes columns
    - level column: filterType "select" with filterValues [0..9]
      and filterFormatter "spellLevel" so dropdown shows formatted
      labels ("Cantrip", "1st-level" etc.) while filtering on
      the underlying integer
    - classes column: arrayField: true so filter-utils flattens
      array values when collecting unique dropdown options
    - Added name column: filterType "text" for substring search
    - Added concentration and ritual columns: filterType "checkbox"
      for boolean filtering; these columns are not rendered in the
      table (no label/field in columns array) but appear in the
      filter bar via the filters array
  V2.0:
    - Full column definition; all columns drive table-renderer.js
      via the template contract
  V1.0: Initial minimal stub
Related Files:
  runtime/js/templates/spells/registry.js
  runtime/js/renderers/table-renderer.js
  runtime/js/formatters/formatter-common.js
  runtime/js/formatters/formatter-spell.js
  runtime/js/_core/filter-utils.js
Notes:
  - columns array drives table-renderer.js (display)
  - filters array drives filter-utils.js (filter bar UI)
  - A field can appear in both columns and filters independently
  - filterType defaults to "select" if omitted on a filterable column
  - filterFormatter: key passed to getFormatter() for option labels
  - filterValues: explicit value list used instead of dataset scan
  - arrayField: true causes filter-utils to flatten arrays when
    collecting unique values for the dropdown
  - name filter uses the dataset scan (no filterValues needed)
    but filterType "text" renders an <input> not a <select>
--------------------------------------------------------- */

export const tableTemplate = {

  columns: [
    { field: "name",         label: "Name",         sortable: true  },
    { field: "level",        label: "Level",        sortable: true,  format: "spellLevel" },
    { field: "school",       label: "School",       sortable: true  },
    { field: "casting_time", label: "Casting Time", sortable: false },
    { field: "classes",      label: "Classes",      sortable: false, format: "classList"  }
  ],

  filters: [
    {
      field:      "name",
      label:      "Name",
      filterType: "text"
    },
    {
      field:       "school",
      label:       "School",
      filterType:  "select"
    },
    {
      field:           "level",
      label:           "Level",
      filterType:      "select",
      filterValues:    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      filterFormatter: "spellLevel"
    },
    {
      field:      "classes",
      label:      "Class",
      filterType: "select",
      arrayField: true
    },
    {
      field:      "concentration",
      label:      "Concentration",
      filterType: "checkbox"
    },
    {
      field:      "ritual",
      label:      "Ritual",
      filterType: "checkbox"
    }
  ]

};
