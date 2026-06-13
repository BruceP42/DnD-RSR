// ---------------------------------------------------------
// Path:         pipeline/data/raw/sources-SRD.js
// File:         sources-SRD.js
// Version:      V1.0
// Data Schema:  V1.1
// System:       DnD-RSR — D&D 5e Dynamic Reference System
// Module/Role:  Raw source book registry — SRD and widely
//               available third-party sources. Input to the
//               pipeline normalize stage.
//               To add a new source book:
//                 1. Add an entry here
//                 2. Add the name → ID mapping to
//                    pipeline/data/config/source-books-map.json
// Created:      2026-05-24
// Changelog:
//   V1.0: Cleaned for DnD-RSR public repository.
//         Removed personal campaign sources (tmokh, wgtee,
//         eow, hcs, hbc). Retained all WotC sources and
//         Kobold Press Tome of Beasts as a third-party example.
//         All entries are bibliographic references only —
//         no game content is included in this file.
//
// Copyright notice:
//   Publisher names and book titles are bibliographic facts
//   and are not subject to copyright. This file contains no
//   game rules, spell descriptions, monster statistics, or
//   other creative content from any of the listed sources.
// ---------------------------------------------------------

export default [

  // ── Wizards of the Coast — Core Rulebooks ─────────────
  {
    id:           "phb14",
    short:        "phb14",
    name:         "Player's Handbook 2014",
    abbreviation: "PHB2014",
    publisher:    "Wizards of the Coast",
    year:         2014
  },
  {
    id:           "phb24",
    short:        "phb24",
    name:         "Player's Handbook 2024",
    abbreviation: "PHB2024",
    publisher:    "Wizards of the Coast",
    year:         2024
  },
  {
    id:           "dmg14",
    short:        "dmg14",
    name:         "Dungeon Master's Guide 2014",
    abbreviation: "DMG2014",
    aliases:      ["Dungeon Master's Guide 2014"],
    publisher:    "Wizards of the Coast",
    year:         2014
  },
  {
    id:           "dmg24",
    short:        "dmg24",
    name:         "Dungeon Master's Guide 2024",
    abbreviation: "DMG2024",
    publisher:    "Wizards of the Coast",
    year:         2024
  },
  {
    id:           "mm14",
    short:        "mm14",
    name:         "Monster Manual 2014",
    abbreviation: "MM2014",
    publisher:    "Wizards of the Coast",
    year:         2014
  },
  {
    id:           "mm24",
    short:        "mm24",
    name:         "Monster Manual 2024",
    abbreviation: "MM2024",
    publisher:    "Wizards of the Coast",
    year:         2024
  },

  // ── Wizards of the Coast — SRD (CC-BY 4.0) ────────────
  // These are the open-licence releases. Content from these
  // sources may be freely used and redistributed with attribution.
  {
    id:           "srd14",
    short:        "srd14",
    name:         "System Reference Document 2014",
    abbreviation: "SRD2014",
    publisher:    "Wizards of the Coast",
    year:         2014
  },
  {
    id:           "srd24",
    short:        "srd24",
    name:         "System Reference Document 2024",
    abbreviation: "SRD2024",
    publisher:    "Wizards of the Coast",
    year:         2024
  },

  // ── Wizards of the Coast — Supplements ────────────────
  {
    id:           "br14",
    short:        "br14",
    name:         "Basic Rules (2014)",
    abbreviation: "BR2014",
    publisher:    "Wizards of the Coast",
    year:         2014
  },
  {
    id:           "eepc",
    short:        "eepc",
    name:         "Elemental Evil Player's Companion",
    abbreviation: "EEPC",
    publisher:    "Wizards of the Coast",
    year:         2015
  },
  {
    id:           "lmop",
    short:        "lmop",
    name:         "Lost Mine of Phandelver",
    abbreviation: "LMoP",
    publisher:    "Wizards of the Coast",
    year:         2014
  },
  {
    id:           "scag",
    short:        "scag",
    name:         "Sword Coast Adventurer's Guide",
    abbreviation: "SCAG",
    publisher:    "Wizards of the Coast",
    year:         2015
  },
  {
    id:           "vgtm",
    short:        "vgtm",
    name:         "Volo's Guide to Monsters",
    abbreviation: "VGtM",
    publisher:    "Wizards of the Coast",
    year:         2016
  },
  {
    id:           "xgte",
    short:        "xgte",
    name:         "Xanathar's Guide to Everything",
    abbreviation: "XGtE",
    publisher:    "Wizards of the Coast",
    year:         2017
  },
  {
    id:           "mtof",
    short:        "mtof",
    name:         "Mordenkainen's Tome of Foes",
    abbreviation: "MToF",
    publisher:    "Wizards of the Coast",
    year:         2018
  },
  {
    id:           "tcoe",
    short:        "tcoe",
    name:         "Tasha's Cauldron of Everything",
    abbreviation: "TCoE",
    publisher:    "Wizards of the Coast",
    year:         2020
  },
  {
    id:           "idrotf",
    short:        "idrotf",
    name:         "Icewind Dale: Rime of the Frostmaiden",
    abbreviation: "IDRotF",
    publisher:    "Wizards of the Coast",
    year:         2020
  },
  {
    id:           "ftod",
    short:        "ftod",
    name:         "Fizban's Treasury of Dragons",
    abbreviation: "FToD",
    publisher:    "Wizards of the Coast",
    year:         2021
  },
  {
    id:           "mpmotm",
    short:        "mpmotm",
    name:         "Mordenkainen Presents: Monsters of the Multiverse",
    abbreviation: "MPMotM",
    publisher:    "Wizards of the Coast",
    year:         2022
  },
  {
    id:           "bpgotg",
    short:        "bpgotg",
    name:         "Bigby Presents: Glory of the Giants",
    abbreviation: "BPGotG",
    publisher:    "Wizards of the Coast",
    year:         2023
  },
  {
    id:           "pabtso",
    short:        "pabtso",
    name:         "Phandelver and Below: The Shattered Obelisk",
    abbreviation: "PaBTSO",
    publisher:    "Wizards of the Coast",
    year:         2023
  },
  {
    id:           "tbomt",
    short:        "tbomt",
    name:         "The Book of Many Things",
    abbreviation: "TBoMT",
    publisher:    "Wizards of the Coast",
    year:         2024
  },
  {
    id:           "ai",
    short:        "ai",
    name:         "Acquisitions Incorporated",
    abbreviation: "AI",
    publisher:    "Wizards of the Coast",
    year:         2019
  },
  {
    id:           "doip",
    short:        "doip",
    name:         "Dragon of Icespire Peak",
    abbreviation: "DoIP",
    publisher:    "Wizards of the Coast",
    year:         2019
  },

  // ── Third-party Publishers ─────────────────────────────
  // Included as examples — no content from these sources
  // is included in any starter dataset shipped with DnD-RSR.
  // Add your own third-party sources using the + Source form.
  {
    id:           "tob1pe23",
    short:        "tob1pe23",
    name:         "Tome of Beasts I: Pocket Edition",
    abbreviation: "ToBIPE",
    aliases:      ["TOB1", "TOBI"],
    publisher:    "Kobold Press",
    year:         2023
  }

];
