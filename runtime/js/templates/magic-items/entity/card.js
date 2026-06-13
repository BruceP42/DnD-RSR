/* ---------------------------------------------------------
Path: runtime/js/templates/magic-items/entity/card.js
File: card.js
Version: V1.4
Data Schema: V1.1
System: D&D Reference System – Reference System Runtime (RSR)
Module/Role: Magic-items entity card template; defines section and
  field structure for single magic-item card rendering. Consumed by
  card-renderer.js via the template registry resolution chain.
Dependencies: None
Created: 2026-04-11
Last Updated: 2026-05-21
Author: Bruce Pilcher
Changelog:
  V1.4: Added nodeType "badges" section as first section. Declares
    attunement badge — a text-based circular icon ("A") rendered
    via .icon.attunement when record.attunement is truthy. CSS
    background-color styling; no image required.
  V1.3: Added Edit button to the buttons array.
  V1.2: Removed sources from identity section.
  V1.1: Added format: "titleCase" to field: "name".
  V1.0: Initial implementation.
Related Files:
  runtime/js/templates/magic-items/registry.js
  runtime/js/renderers/card-renderer.js
  runtime/js/formatters/formatter-common.js
Notes:
  - attunement badge shows when record.attunement is truthy
    (boolean true or any non-empty string)
  - attunement_restrictions field still renders as a labelled
    field row below attunement; the badge is a visual indicator
    only, not a replacement for the field
  - badges section must be first so .spell-icons positions
    correctly (absolute, top-right of the card)
--------------------------------------------------------- */

export const cardTemplate = {
  type: "magic-items.entity.card",

  buttons: [
    {
      label:  "Edit",
      action: "edit-record",
      class:  "fancy-scroll-button"
    }
  ],

  sections: [
    {
      nodeType: "badges",
      badges: [
        { field: "attunement", class: "attunement", title: "Requires Attunement" }
      ]
    },
    {
      id: "identity",
      fields: [
        { field: "name",                    label: "Name",         format: "titleCase"              },
        { field: "magic_item_category",     label: "Category",     format: "itemCategory"           },
        { field: "rarity",                  label: "Rarity",       format: "rarity"                 },
        { field: "attunement",              label: "Attunement",   format: "attunement"             },
        { field: "attunement_restrictions", label: "Restrictions", format: "attunementRestrictions" }
      ]
    },
    {
      id: "description",
      fields: [
        { field: "item_desc", label: null, format: "paragraphs" }
      ]
    }
  ]
};
