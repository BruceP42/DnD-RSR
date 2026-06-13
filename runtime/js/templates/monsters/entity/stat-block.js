/* ---------------------------------------------------------
Path: runtime/js/templates/monsters/entity/stat-block.js
File: stat-block.js
Version: V1.2
Data Schema: V1.1
System: D&D Reference System - Reference System Runtime (RSR)
Module/Role: Monster entity stat-block template; defines section
  and field structure for the full stat-block renderer.
  Consumed by stat-block-renderer.js via the template registry
  resolution chain.
Dependencies: None
Created: 2026
Last Updated: 2026-04-19
Author: Bruce Pilcher
Changelog:
  V1.2:
    - Option A resolution: replaced all virtual fields with real
      Schema V1.1 field names, matching card.js V2.0 approach
    - header section: size_type split into size, creature_type,
      subtype; name kept as first field
    - defences section: ac_armor split into ac + armor_type;
      hp_dice split into hp + hit_dice
    - senses-languages section: cr_xp split into cr + xp
    - Removed IMPLEMENTATION NOTES block (resolved)
  V1.1:
    - Documented virtual field conflict — template not changed
    - Normalized file header to block delimiter style
  V1.0: Initial release with full stat block section structure
Related Files:
  runtime/js/templates/monsters/registry.js
  runtime/js/renderers/monsters/stat-block-renderer.js
  runtime/js/renderers/monsters/registry.js
  runtime/js/validators/monsters/registry.js
Notes:
  - nodeType vocabulary (canonical — also in stat-block-renderer.js):
      "fields"       simple key/value pairs, rendered in order
      "ability-grid" fixed six-score grid, renderer owns layout
      "stat-list"    optional combat stats, skipped if all empty
      "action-list"  iterated action blocks with name + desc[]
  - optional: true sections are skipped entirely when source
    array is empty or absent on the record
  - format keys map to formatter-common.js registry
  - subtype is optional on the record (empty string when absent)
  - armor_type is optional on the record
  - hit_dice is always present in Schema V1.1 data
--------------------------------------------------------- */

export const monstersStatBlockTemplate = {
  type: "monsters.entity.stat-block",
  sections: [
    {
      id:       "header",
      nodeType: "fields",
      fields: [
        { field: "name",          label: "Name"      },
        { field: "size",          label: "Size"      },
        { field: "creature_type", label: "Type"      },
        { field: "subtype",       label: "Subtype"   },
        { field: "alignment",     label: "Alignment" }
      ]
    },
    {
      id:       "defences",
      nodeType: "fields",
      fields: [
        { field: "ac",        label: "Armor Class" },
        { field: "armor_type",label: "Armor"       },
        { field: "hp",        label: "Hit Points"  },
        { field: "hit_dice",  label: "Hit Dice"    },
        { field: "speed",     label: "Speed"       }
      ]
    },
    {
      id:       "ability-scores",
      nodeType: "ability-grid"
      // Renderer owns layout - no fields array needed
      // Uses ability_scores.str/dex/con/int/wis/cha (lowercase, canonical)
      // Displays score + modifier: e.g. STR 18 (+4)
      // Modifier formula: Math.floor((score - 10) / 2)
    },
    {
      id:       "combat-stats",
      nodeType: "stat-list",
      optional: true,
      fields: [
        { field: "saving_throws",          label: "Saving Throws"          },
        { field: "skills",                 label: "Skills"                 },
        { field: "damage_vulnerabilities", label: "Damage Vulnerabilities" },
        { field: "damage_resistances",     label: "Damage Resistances"     },
        { field: "damage_immunities",      label: "Damage Immunities"      },
        { field: "condition_immunities",   label: "Condition Immunities"   }
      ]
    },
    {
      id:       "senses-languages",
      nodeType: "fields",
      fields: [
        { field: "senses",    label: "Senses"    },
        { field: "languages", label: "Languages" },
        { field: "cr",        label: "Challenge" },
        { field: "xp",        label: "XP"        }
      ]
    },
    {
      id:       "traits",
      nodeType: "action-list",
      optional: true,
      source:   "traits",
      title:    "Traits"
    },
    {
      id:       "actions",
      nodeType: "action-list",
      optional: true,
      source:   "actions",
      title:    "Actions"
    },
    {
      id:       "bonus-actions",
      nodeType: "action-list",
      optional: true,
      source:   "bonus_actions",
      title:    "Bonus Actions"
    },
    {
      id:       "reactions",
      nodeType: "action-list",
      optional: true,
      source:   "reactions",
      title:    "Reactions"
    },
    {
      id:       "legendary-actions",
      nodeType: "action-list",
      optional: true,
      source:   "legendary_actions",
      title:    "Legendary Actions"
    },
    {
      id:       "lair-actions",
      nodeType: "action-list",
      optional: true,
      source:   "lair_actions",
      title:    "Lair Actions"
    },
    {
      id:       "regional-effects",
      nodeType: "action-list",
      optional: true,
      source:   "regional_effects",
      title:    "Regional Effects"
    }
  ]
};
