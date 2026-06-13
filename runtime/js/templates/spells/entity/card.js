/* ---------------------------------------------------------
Path: runtime/js/templates/spells/entity/card.js
File: card.js
Version: V2.3
Data Schema: V1.1
System: D&D Reference System – Reference System Runtime (RSR)
Module/Role: Spell entity card template; defines section and field
  structure for single-spell card rendering. Consumed by
  card-renderer.js via the template registry resolution chain.
Dependencies: None
Created: 2026-03-19
Last Updated: 2026-05-21
Author: Bruce Pilcher
Changelog:
  V2.3: Added nodeType "badges" section as first section. Declares
    ritual and concentration badges. card-renderer.js renders each
    as a .icon span inside .spell-icons when the boolean field is
    true. CSS handles image via background-image (ritual.png,
    concentration.png).
  V2.2: Added Button section to contain the Edit button.
  V2.1: Added format: "titleCase" to field: "name".
  V2.0: Full section/field definition aligned with Model C
    architecture. format keys map to formatter-common.js registry
    entries. card-renderer.js applies formatters at render time.
    material added as nullable field — renderer suppresses it when
    formatter returns empty string. ritual and concentration badge
    rendering deferred to follow-up session (requires condition
    system in renderer).
  V1.0: Minimal stub — 6 fields, single section, no formatters.
Related Files:
  runtime/js/templates/spells/registry.js
  runtime/js/renderers/card-renderer.js
  runtime/js/formatters/formatter-common.js
  runtime/js/formatters/formatter-spell.js
Notes:
  - format key is optional — fields without it render as plain strings
  - label: null suppresses the label element in the renderer; used
    for description body text where a label would be redundant
  - material has format: "material" — formatMaterial returns "" when
    absent, causing the renderer to omit the field row entirely
  - higher_level is optional in the data — same suppression applies
  - badges section must be first so .spell-icons positions correctly
    (absolute, top-right of the card)
--------------------------------------------------------- */

export const spellEntityCardTemplate = {
  type: "spells.entity.card",

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
        { field: "ritual",        class: "ritual",        title: "Ritual"          },
        { field: "concentration", class: "concentration", title: "Concentration"   }
      ]
    },
    {
      id: "identity",
      fields: [
        { field: "name",   label: "Name",   format: "titleCase"  },
        { field: "level",  label: "Level",  format: "spellLevel" },
        { field: "school", label: "School"                       }
      ]
    },
    {
      id: "mechanics",
      fields: [
        { field: "casting_time", label: "Casting Time"                     },
        { field: "range",        label: "Range"                            },
        { field: "components",   label: "Components", format: "components" },
        { field: "material",     label: "Material",   format: "material"   },
        { field: "duration",     label: "Duration"                         },
        { field: "classes",      label: "Classes",    format: "classList"  }
      ]
    },
    {
      id: "description",
      fields: [
        { field: "spell_desc",   label: null,                format: "paragraphs" },
        { field: "higher_level", label: "At Higher Levels",  format: "paragraphs" }
      ]
    }
  ]
};
