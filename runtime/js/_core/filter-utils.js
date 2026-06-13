/* ---------------------------------------------------------
Path: runtime/js/_core/filter-utils.js
File: filter-utils.js
Version: V1.1
Data Schema: V1.1
System: DnD-RSR — D&D 5e Dynamic Reference System
Module/Role: Shared filter bar rendering utility; builds and injects
  a filter bar into the #filters div based on the template's filters
  array. Domain-agnostic — all filter intent comes from the template.
  Wires control changes to URL-driven state transitions via the
  controller's transition() function.
Dependencies:
  - runtime/js/formatters/formatter-common.js  (getFormatter)
  - runtime/js/registry/dataset-registry.js    (getEngine)
  - runtime/js/_core/domain-config.js          (loadDomainConfig)
Created: 2026-04-12
Last Updated: 2026-06-07
Author: Bruce Pilcher
Changelog:
  V1.1:
    - Added import of loadDomainConfig from domain-config.js.
    - loadDomainConfig(domain) called once per render in
      _renderFilterBarAsync; result passed to buildSelect.
    - buildSelect: when filterDef.useConfig is true, option values
      are taken from cfg.getValues(field) in canonical config order
      with no sort applied. Falls back to dataset scan when
      useConfig is false/absent or when config returns null.
  V1.0: Initial implementation. Supports four filterType values:
    "text"     → <input type="text"> substring search
    "select"   → <select> dropdown, options derived from dataset
                 or from filterValues + filterFormatter
    "range"    → two <input type="number"> min/max pair
    "checkbox" → <input type="checkbox"> boolean toggle
    Reset button clears all filters via transition({ filter: {} }).
    Active filter state read from viewState.filter to keep
    controls in sync with URL on re-render.
Related Files:
  runtime/js/templates/spells/summary/table.js
  runtime/js/templates/monsters/summary/table.js
  runtime/js/templates/magic-items/summary/table.js
  runtime/js/controllers/spells-controller.js
  runtime/js/controllers/monsters-controller.js
  runtime/js/controllers/magic-items-controller.js
  runtime/js/formatters/formatter-common.js
  runtime/js/registry/dataset-registry.js
  runtime/js/_core/domain-config.js
  config/magic-items-config.json
Notes:
  - Template filters array is the only domain-specific input
  - useConfig: true on a filter definition → option values loaded
    from domain-config.js in canonical config order; no dataset scan
  - filterValues: explicit value list; skips dataset scan and config
    when provided (used for level 0-9 where scan order is unreliable)
  - Reads engine via getEngine(domain) to scan dataset for unique
    select option values — does NOT re-query the filtered dataset;
    always scans the full unfiltered collection so all options
    remain visible regardless of active filters
  - arrayField: true causes option collection to flatten arrays
    (e.g. classes: ["Wizard","Druid"] → two separate options)
  - filterFormatter: key passed to getFormatter() to produce
    display labels for options (value stored, label displayed)
  - Range inputs: step="any" to support decimal CR values
  - Checkbox: checked when viewState.filter[field] === true
  - Re-render is idempotent: container is cleared and rebuilt
    each call; no duplicate binding guards needed
  - All controls use "change" event (not "input") for consistency
    except text inputs which use "input" for live search feel
--------------------------------------------------------- */

import { getFormatter }    from "../formatters/formatter-common.js";
import { getEngine }       from "../registry/dataset-registry.js";
import { loadDomainConfig } from "./domain-config.js";

/* ---------------------------------------------------------
   Collect unique values for a select filter from the full
   unfiltered dataset via the engine.
--------------------------------------------------------- */
function collectUniqueValues(engine, field, arrayField = false) {
  const all = engine.getCollection({});
  const seen = new Set();

  for (const record of all) {
    const value = record[field];
    if (value === null || value === undefined) continue;

    if (arrayField && Array.isArray(value)) {
      for (const item of value) {
        if (item !== null && item !== undefined && item !== "") {
          seen.add(String(item));
        }
      }
    } else {
      if (value !== "") seen.add(String(value));
    }
  }

  return [...seen].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

/* ---------------------------------------------------------
   Build a <select> element for a filter field.
   Resolution order for option values:
     1. filterDef.useConfig → cfg.getValues(field) in config order
     2. filterDef.filterValues → explicit list (e.g. spell levels)
     3. dataset scan via collectUniqueValues (alphabetical)
--------------------------------------------------------- */
function buildSelect({ filterDef, engine, cfg, currentValue }) {
  const { field, label, filterValues, filterFormatter, arrayField, useConfig } = filterDef;

  // Resolve option values
  let values;
  if (useConfig) {
    // Config-driven: canonical order, no re-sort
    values = cfg.getValues(field) ?? collectUniqueValues(engine, field, arrayField || false);
  } else if (filterValues) {
    // Explicit list supplied by template
    values = filterValues;
  } else {
    // Dataset scan: alphabetical
    values = collectUniqueValues(engine, field, arrayField || false);
  }

  // Resolve label formatter if specified
  const fmt = filterFormatter ? getFormatter(filterFormatter) : null;

  const select = document.createElement("select");
  select.id    = `filter-${field}`;
  select.name  = field;

  // "All" option
  const allOpt       = document.createElement("option");
  allOpt.value       = "";
  allOpt.textContent = `— All ${label}s —`;
  select.appendChild(allOpt);

  for (const val of values) {
    const opt       = document.createElement("option");
    opt.value       = String(val);
    opt.textContent = fmt ? fmt(val) : String(val);
    if (String(val) === String(currentValue)) opt.selected = true;
    select.appendChild(opt);
  }

  return select;
}

/* ---------------------------------------------------------
   Build a text <input> for a filter field.
--------------------------------------------------------- */
function buildTextInput({ field, currentValue }) {
  const input       = document.createElement("input");
  input.type        = "text";
  input.id          = `filter-${field}`;
  input.name        = field;
  input.placeholder = `Search…`;
  input.value       = (currentValue && typeof currentValue === "object" && "text" in currentValue)
    ? currentValue.text
    : (currentValue || "");
  return input;
}

/* ---------------------------------------------------------
   Build a range min/max input pair for a filter field.
--------------------------------------------------------- */
function buildRangeInputs({ field, currentValue }) {
  const wrapper = document.createElement("span");
  wrapper.className = "filter-range-pair";

  const minInput       = document.createElement("input");
  minInput.type        = "number";
  minInput.id          = `filter-${field}-min`;
  minInput.name        = `${field}_min`;
  minInput.placeholder = "Min";
  minInput.step        = "any";
  minInput.value       = (currentValue && currentValue.min !== undefined)
    ? currentValue.min : "";

  const maxInput       = document.createElement("input");
  maxInput.type        = "number";
  maxInput.id          = `filter-${field}-max`;
  maxInput.name        = `${field}_max`;
  maxInput.placeholder = "Max";
  maxInput.step        = "any";
  maxInput.value       = (currentValue && currentValue.max !== undefined)
    ? currentValue.max : "";

  wrapper.appendChild(minInput);
  wrapper.appendChild(maxInput);

  return { wrapper, minInput, maxInput };
}

/* ---------------------------------------------------------
   Build a checkbox <input> for a boolean filter field.
--------------------------------------------------------- */
function buildCheckbox({ field, currentValue }) {
  const input   = document.createElement("input");
  input.type    = "checkbox";
  input.id      = `filter-${field}`;
  input.name    = field;
  input.checked = currentValue === true;
  return input;
}

/* ---------------------------------------------------------
   Main export: renderFilterBar
   Clears container and rebuilds the full filter bar from
   the template's filters array.
--------------------------------------------------------- */
/**
 * @param {Object}   params
 * @param {Element}  params.container  - the #filters div element
 * @param {string}   params.domain     - domain identifier
 * @param {Object}   params.viewState  - current controller viewState
 * @param {Function} params.transition - controller transition()
 */
export function renderFilterBar({ container, domain, viewState, transition }) {
  _renderFilterBarAsync({ container, domain, viewState, transition })
    .catch(err => {
      console.error("[filterUtils] renderFilterBar failed:", err);
      container.innerHTML =
        `<p style="color:red;">Filter bar error: ${err.message}</p>`;
    });
}

async function _renderFilterBarAsync({ container, domain, viewState, transition }) {

  // --- Load the template registry for this domain
  const templateModule = await import(
    `../templates/${domain}/registry.js`
  );

  const registryObj = Object.values(templateModule).find(
    v => v !== null && typeof v === "object" && !Array.isArray(v)
  );
  const template = registryObj?.[`${domain}.summary.table`];

  const filters = template?.filters;
  if (!filters || filters.length === 0) {
    container.innerHTML = "";
    return;
  }

  // --- Load domain config once for this render.
  //     Used by buildSelect when filterDef.useConfig is true.
  //     Safe for all domains — returns empty config if no file exists.
  const cfg = await loadDomainConfig(domain);

  // --- If the form already exists, only sync non-text control values.
  const existingForm = container.querySelector("#filter-form");
  if (existingForm) {
    for (const filterDef of filters) {
      const { field, filterType = "select" } = filterDef;
      const currentValue = viewState.filter?.[field];

      if (filterType === "select") {
        const sel = existingForm.querySelector(`#filter-${field}`);
        if (sel) sel.value = currentValue !== undefined ? String(currentValue) : "";

      } else if (filterType === "range") {
        const minEl = existingForm.querySelector(`#filter-${field}-min`);
        const maxEl = existingForm.querySelector(`#filter-${field}-max`);
        if (minEl) minEl.value = (currentValue?.min !== undefined) ? currentValue.min : "";
        if (maxEl) maxEl.value = (currentValue?.max !== undefined) ? currentValue.max : "";

      } else if (filterType === "checkbox") {
        const cb = existingForm.querySelector(`#filter-${field}`);
        if (cb) cb.checked = currentValue === true;
      }
      // filterType "text" — intentionally not synced; user is typing
    }
    return;
  }

  // --- First render: build the form from scratch
  const engine = getEngine(domain);

  container.innerHTML = "";

  const form = document.createElement("form");
  form.id    = "filter-form";
  form.addEventListener("submit", e => e.preventDefault());

  for (const filterDef of filters) {
    const { field, label, filterType = "select" } = filterDef;
    const currentValue = viewState.filter?.[field];

    const group = document.createElement("span");
    group.className = "filter-group";

    const lbl       = document.createElement("label");
    lbl.htmlFor     = `filter-${field}`;
    lbl.textContent = label;
    group.appendChild(lbl);

    if (filterType === "text") {
      const input = buildTextInput({ field, currentValue });
      input.addEventListener("input", () => {
        const val = input.value.trim();
        const newFilter = { ...viewState.filter };
        if (val === "") {
          delete newFilter[field];
        } else {
          newFilter[field] = { text: val };
        }
        transition({ filter: newFilter });
      });
      group.appendChild(input);

    } else if (filterType === "select") {
      const select = buildSelect({ filterDef, engine, cfg, currentValue });
      select.addEventListener("change", () => {
        const val = select.value;
        const newFilter = { ...viewState.filter };
        if (val === "") {
          delete newFilter[field];
        } else {
          const isNumeric = filterDef.filterValues &&
            filterDef.filterValues.length > 0 &&
            typeof filterDef.filterValues[0] === "number";
          newFilter[field] = isNumeric ? Number(val) : val;
        }
        transition({ filter: newFilter });
      });
      group.appendChild(select);

    } else if (filterType === "range") {
      const { wrapper, minInput, maxInput } =
        buildRangeInputs({ field, currentValue });

      const applyRange = () => {
        const minVal = minInput.value.trim();
        const maxVal = maxInput.value.trim();
        const newFilter = { ...viewState.filter };
        if (minVal === "" && maxVal === "") {
          delete newFilter[field];
        } else {
          const range = {};
          if (minVal !== "") range.min = Number(minVal);
          if (maxVal !== "") range.max = Number(maxVal);
          newFilter[field] = range;
        }
        transition({ filter: newFilter });
      };

      minInput.addEventListener("change", applyRange);
      maxInput.addEventListener("change", applyRange);
      group.appendChild(wrapper);

    } else if (filterType === "checkbox") {
      const checkbox = buildCheckbox({ field, currentValue });
      checkbox.addEventListener("change", () => {
        const newFilter = { ...viewState.filter };
        if (checkbox.checked) {
          newFilter[field] = true;
        } else {
          delete newFilter[field];
        }
        transition({ filter: newFilter });
      });
      // Checkbox label follows the input
      group.removeChild(lbl);
      group.appendChild(checkbox);
      group.appendChild(lbl);
    }

    form.appendChild(group);
  }

  // --- Reset button
  const resetBtn       = document.createElement("button");
  resetBtn.type        = "button";
  resetBtn.className   = "scroll-button";
  resetBtn.textContent = "Reset Filters";
  resetBtn.addEventListener("click", () => {
    container.innerHTML = "";
    transition({ filter: {} });
  });
  form.appendChild(resetBtn);

  container.appendChild(form);
}
