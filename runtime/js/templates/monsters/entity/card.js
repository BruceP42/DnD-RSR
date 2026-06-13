/* ---------------------------------------------------------
Path: runtime/js/templates/monsters/entity/card.js
File: card.js
Version: V2.4
Data Schema: V1.1
System: D&D Reference System - Reference System Runtime (RSR)
Module/Role: Monster entity card template; defines section and
  field structure for single-monster card rendering. Consumed
  by card-renderer.js via the template registry resolution chain.
Dependencies: None
Created: 2026
Last Updated: 2026-05-11
Author: Bruce Pilcher
Changelog:
  V2.4:
    -  Added Edit button to the button section.
  V2.3:
    - Replaced size, creature_type, subtype, alignment individual fields with creature-meta nodeType section
    - Replaced ac, armor_type individual fields with armor-class nodeType section (label: AC)
    - Replaced hp, hit_dice individual fields with hit-points nodeType section (label: HP)
    - Replaced cr, xp individual fields with cr-xp nodeType section
    - ability_scores label changed to null
    - Added senses formatter key, languages formatter key to stats section fields
    - speed formatter already correct — no change
  V2.2:
   - added format: "titleCase" to field: "name",
  V2.1:
    - Added top-level buttons array; card-renderer.js renders
      these into .card-footer-right
    - One button: "Full Stat Block" with action "open-stat-block"
      and data-id resolved from record.id at render time
      monsters-controller.js bindInteractions() handles the click
      via data-action="open-stat-block" delegation
  V2.0: Rewritten to use real Schema V1.1 field names only.
    Invented combined fields replaced with real adjacent fields.
    format keys map to formatter-common.js registry.
    ability_scores and speed use new monster formatters.
    Sections: identity, defences, ability-scores, stats, narrative.
    Matches card-renderer.js Model C contract.
  V1.0: Initial release; flat single-section card with invented
    combined fields that do not exist in Schema V1.1 data.
Related Files:
  runtime/js/templates/monsters/registry.js
  runtime/js/renderers/card-renderer.js
  runtime/js/formatters/formatter-common.js
  runtime/js/formatters/formatter-monster.js
Notes:
  - All field names are Schema V1.1 canonical names
  - armor_type, subtype, xp are optional — renderer suppresses
    when empty via safeFormat returning ""
  - ability_scores uses format: "abilityScores" -> flat stat line
  - speed uses format: "speed" -> "Walk 30 ft., Fly 60 ft." etc.
  - traits, actions etc. are action-list arrays — not renderable
    by card-renderer.js plain field model; deferred to stat-block
  - buttons array: each entry has label, action, class (optional)
    card-renderer.js emits <button data-action="..." data-id="...">
    controller owns the click behaviour via event delegation
--------------------------------------------------------- */

export const monstersEntityCardTemplate = {
  type: "monsters.entity.card",
  buttons: [
      {
        label:  "Edit",
        action: "edit-record",
        class:  "fancy-scroll-button"
      },
      {
        label:  "Stat Block",
        action: "open-stat-block",
        class:  "fancy-scroll-button"
      }
    ],

  sections: [
    {
      id: "identity",
      fields: [
        { field: "name", label: "Name", format: "titleCase" }
      ]
    },
    {
      id:       "creature-meta",
      nodeType: "creature-meta"
    },
    {
      id:       "armor-class",
      nodeType: "armor-class"
    },
    {
      id:       "hit-points",
      nodeType: "hit-points"
    },
    {
      id: "defences",
      fields: [
        { field: "speed", label: "Speed", format: "speed" }
      ]
    },
    {
      id: "ability-scores",
      fields: [
        { field: "ability_scores", label: null, format: "abilityScores" }
      ]
    },
    {
      id: "stats",
      fields: [
        { field: "senses",    label: "Senses",    format: "senses"    },
        { field: "languages", label: "Languages", format: "languages" }
      ]
    },
    {
      id:       "cr-xp",
      nodeType: "cr-xp"
    }
  ]
};
