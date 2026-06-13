# DnD-RSR — D&D 5e Dynamic Reference System

- A browser-based reference tool for Dungeons & Dragons 5th Edition.
- Look up spells, monsters, and magic items instantly during play.
- Additional domains (i.e. feats or NPCs) can be added by following a repeatable pattern.
- Add and edit your own entries through the built-in edit interface.
- Runs entirely on your local machine — no internet connection required during play.

---

## What It Does

- **Browse** various domains of D&D data - spells, monsters, and magic items - in a fast searchable table
- **Filter** by domain-specific attributes (spell school, monster type, item rarity, etc.)
- **View** full detail cards alongside the results table in a split-pane layout
- **Add and edit** your own entries through a built-in form interface
- **Pipeline system** detects when data files are out of date and notifies you with a dismissible banner

---

## Requirements

- Python 3.x (for the local server)
- A modern browser (Firefox or Chrome recommended)
- No other dependencies — everything else is plain HTML, CSS, and JavaScript

Install the Python server dependencies:

```bash
pip install -r requirements.txt
```

---

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/BruceP42/DnD-RSR.git
cd DnD-RSR

# 2. Install dependencies
pip install -r requirements.txt

# 3. Start the server
python server.py

# 4. Open your browser
# Navigate to http://localhost:8000/
```

The system opens in Browse mode showing the Spells domain by default.

---

## Navigating the System

The domain navigation bar at the top of the page lets you switch between domains:

| Button | What it shows |
|---|---|
| Spells | All spells, filterable by level, school, class, etc. |
| Monsters | All monsters, filterable by type, CR, size, etc. |
| Magic Items | All magic items, filterable by rarity, type, etc. |

Click any row in the results table to open the full detail card in the right-hand pane. Click the close button or click another row to dismiss it. The detail card for the monsters domain shows only some of the information available about the monster. It has a "stat-block" button that opens a stat-block replacing the table. All information about the monster is displayed in the stat-block.

---

## Adding and Editing Entries

Each domain has an Add link in the navigation bar:

| Button | Opens |
|---|---|
| + Spell | Spell entry form |
| + Magic Item | Magic item entry form |
| + Monster | Monster entry form |
| + Source | Source book entry form |

Fill in the form and click Save. The entry is written directly to the data files. The pipeline banner will appear on next page load to indicate the data index needs rebuilding.

> **Note:** Saving requires the local server (`server.py`) to be running. The built-in browser file API cannot write files directly to disk.

---

## Directory Structure

```
DnD-RSR/
  index.html
  server.py
  requirements.txt
  README.md
  .gitignore
  config/
    magic-items-config.json
    monsters-config.json
    spells-config.json
  css/
    base.css
    buttons.css
    collapsible.css
    colour-themes.css
    flex.css
    footer.css
    layout.css
    list.css
    monster-statblock.css
    navbar.css
    ribbon.css
    rsr.css
    section.css
    spell-card.css
    table.css
    typography.css
    utility.css
  fonts/
    IM FELL English SC.css
    IM FELL English SC.woff2
    im-fell-english-v14-latin-regular.woff2
  images/
    TaperedLine.png
    attunement.svg
    concentration.svg
    ritual.svg
    parchment-Full_bkgnd-same.png
    parchment-top3.png
    parchment-texture.jpg
  pipeline/
    build-all.js
    package.json
    _core/
    aggregate/
    normalize/
    utils/
    verify/
    data/
      config/
        source-books-map.json
      raw/
        magic-items-SRD14.js
        monsters-SRD14.js
        sources.js
        spells-SRD14.js
  runtime/
    data/
      magic-items-dataset.js
      monsters-dataset.js
      sources-dataset.js
      spells-dataset.js
    js/
      _core/
      controllers/
      engines/
      formatters/
      forms/
      registry/
      renderers/
      templates/
      validators/
      writers/
```

---

## Data Files

There are two types of data files: Raw and Normalized. All data files regardless of type are plain JavaScript modules. They can be edited directly in a text editor or through the built-in edit interface. Only Raw dataset files should be edited directly. Changes to Normalized dataset files are made by the built-in interface or by the pipeline. Manual editing of Normalized dataset files is not recommended and can result in data loss or pipeline failures.

### Raw Data Files

Raw data lives in `pipeline/data/raw/`. Files follow the naming convention `<domain>-<sourceCode>.js`. The domain identifies the type of data (e.g. `spells`, `monsters`, `magic-items`). The source code identifies the source material (e.g. `SRD14` for the 5.1 System Reference Document).

The repository ships with WotC SRD 5.1 data released under Creative Commons Attribution 4.0 (CC-BY 4.0):

| File | Contents |
|---|---|
| `magic-items-SRD14.js` | 361 magic item entries |
| `monsters-SRD14.js` | 333 monster entries |
| `spells-SRD14.js` | 318 spell entries |
| `sources.js` | Source book registry |

Additional raw data files placed in this directory following the same naming convention will be picked up and processed by the pipeline automatically. Multiple raw files for the same domain — for example `spells-SRD14.js` and `spells-homebrew.js` — are aggregated by the pipeline into a single `spells-dataset.js` file. There is always exactly one normalized dataset file per domain regardless of how many raw source files contribute to it.

### Normalized Data Files

Normalized data lives in `runtime/data/`. Each domain has its own dataset file:

| File | Contents |
|---|---|
| `spells-dataset.js` | All spell entries |
| `monsters-dataset.js` | All monster entries |
| `magic-items-dataset.js` | All magic item entries |
| `sources-dataset.js` | Source book registry |

These files are generated by the pipeline and committed to the repository so that the system works immediately after cloning without requiring a pipeline run.

---

## The Pipeline

When data files are edited via the user interface, a `pipeline-needed.flag` file is created at the project root. On next page load, a banner appears at the top of the screen:

> ⚙ Dataset out of date — a pipeline run is needed.

Note that `pipeline-needed.flag` is a runtime file and is not committed to the repository — it is listed in `.gitignore` and will only appear on your local machine after a save operation.

To rebuild the normalized dataset files, run:

```bash
cd pipeline
node build-all.js
```

Node.js is required to run the pipeline. The pipeline reads from `pipeline/data/raw/`, normalizes and validates the data, and writes the updated dataset files to `runtime/data/`.

> **Full pipeline documentation will be added as that section of the system is completed.**

---

## Adding a New Domain

The system is designed to support additional domains beyond the three shipped (spells, monsters, magic items). Feats, NPCs, vehicles, and other D&D content types are all candidates. The architecture — raw data files, pipeline normalization, runtime controllers, templates, and forms — is consistent across domains, so adding a new one follows a repeatable pattern.

Full documentation for adding a new domain will be added here as the process is formalized. If you want to attempt it before then, reading the existing domain implementations side by side is the best starting point.

---

## Running on Linux or Android (Termux)

The server and all data files are cross-platform. On Linux or Android (via Termux):

```bash
pip install flask flask-cors
python server.py
```

Then open `http://localhost:8000/` in a browser.

On Android, use the local IP address to open the system in Chrome while the server runs in Termux.

---

## Contributing

This is a personal project. Contributions are not expected, and I will be honest — I am not experienced enough with GitHub collaboration to handle pull requests confidently. If you have a suggestion or find a bug, please open an issue to discuss it first. That way we can figure out together whether and how a contribution makes sense before any code changes hands.

---

## Licence

### Code

Copyright (c) 2026 A. Bruce Pilcher

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

### SRD Data

The System Reference Documents (SRD 5.1 and SRD 5.2) are published by Wizards of the Coast under the Creative Commons Attribution 4.0 International licence (CC-BY 4.0). All other entries are bibliographic references only — no game content from those sources is included in any starter dataset shipped with DnD-RSR or embedded in files or scripts included with DnD-RSR.

---

## Changelog

| Version | Date | Notes |
|---|---|---|
| V0.2 | 2026-06-13 | README completed; MIT licence added; GitHub repository established |
| V0.1 | 2026-05-24 | Initial repository structure and README |

---

## Acknowledgements

This project was developed with substantial assistance from Claude (Anthropic), which was used throughout for architecture decisions, code generation, and documentation. The system design, data, and editorial judgement are my own.
