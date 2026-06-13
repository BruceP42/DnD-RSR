/* ---------------------------------------------------------
Path: runtime/js/controllers/spells-controller.js
File: spells-controller.js
Version: V4.4
Data Schema: V1.1
System: D&D Reference System – Reference System Runtime (RSR)
Module/Role: Page controller for spells reference view; manages
  URL-driven state, rendering via referenceService, and
  interaction binding for the spells domain
Dependencies:
  - runtime/js/reference-service.js
  - runtime/js/_core/sort-utils.js
  - runtime/js/_core/filter-utils.js
  - runtime/js/_core/table-interaction-controller.js
  - runtime/js/registry/dataset-registry.js
Created: 2026-04-05
Last Updated: 2026-05-11
Author: Bruce Pilcher
Changelog:
  V4.4:
    - Added edit-record click handler in init() on #card-pane.
    - Edit button on the spell card navigates to ?domain=spells&appMode=edit&id=<id>.
  V4.3:
    - appMode=edit renderReference stub replaced with a live navigation handler.
    - Row click navigates to ?domain=spells&appMode=edit&id=<id>, handing off to add-edit-controller which reads the id param and mounts the edit form.
  V4.2
    - Fixed appendCardToStack: now adds split-active to #view-container and wires close button after each append; pane was silently populated but never made visible
    - appendCardToStack: added per-card close button (.stack-card-close); removes individual card on click; collapses pane when last card removed
  V4.1:
    - Renamed appMode "play" → "browse" throughout
    - Implemented appMode=stack: row clicks append cards to #card-stack via appendCardToStack(); no maximum stack depth
    - Added isBrowseSplit / isStackSplit split-pane logic; stack pane stays open while #card-stack has children
    - Stack close button clears #card-stack and collapses pane
    - Added appMode=edit routing stub in bindInteractions(); logs warning
    - Updated all "play mode" comment references to "browse mode"
  V4.0:
    - Added appMode to viewState (default "play"); serialized as appMode URL param (distinct from renderMode / mode param)
    - parseURL reads appMode param; defaults to "play"
    - buildURL serializes appMode param
    - renderFromState: in play mode with selectedId set, renders split-pane layout — table stays in #results, card renders into #card-stack; adds split-active class to #view-container
    - renderFromState: in all other cases clears #card-stack, removes split-active class, behaves as before
    - bindInteractions: in play mode, row click sets selectedId only — does not change viewType or renderMode
    - bindInteractions: in manage mode, row click behaves as before (transitions to entity/card view)
    - renderCardPane: new private function; renders entity card into #card-stack and wires close button
    - injectBackButton: now a no-op in play mode (close button in card pane replaces it)
  V3.2:
    - Imported renderFilterBar from runtime/js/_core/filter-utils.js
    - parseURL now collapses filter_<field>_min / filter_<field>_max pairs into range objects { min, max } in the filter map
    - parseURL now recognises filter_<field>=true/false as boolean values rather than strings
    - buildURL now expands range objects back to _min / _max params
    - buildURL serializes boolean filter values as "true"/"false"
    - renderFromState calls renderFilterBar after table render; clears #filters div in entity view
  V3.1:
    - Imported bindTableSortClicks from runtime/js/_core/sort-utils.js
    - bindInteractions now calls bindTableSortClicks when renderMode is "table"
  V3.0:
    - Added sort, order, and filter to viewState
    - parseURL extracts sort/order and filter_* params
    - buildURL serializes sort/order and filter_* params
    - renderFromState passes sort/order/filter to referenceService
  V2.0:
    - Replaced direct renderReference + loadDataset with referenceService.render()
  V1.0: Extracted from spells.html inline script
Related Files:
  - runtime/js/reference-service.js
  - runtime/js/registry/dataset-registry.js
  - runtime/js/_core/sort-utils.js
  - runtime/js/_core/filter-utils.js
  - runtime/js/_core/table-interaction-controller.js
Notes:
  - URL is the single source of truth
  - appMode param is distinct from renderMode (mode param)
  - In browse mode, renderMode stays "table" throughout split-pane
    use; the card render is driven by selectedId, not renderMode
  - Range filter params: filter_<field>_min, filter_<field>_max
  - Boolean filter params: filter_<field>=true or =false
  - filter_* params namespaced to avoid collision with
    navigation params (domain, view, mode, id, appMode)
  - sort and order are always serialized together
  - Controller knows nothing about data or engines
--------------------------------------------------------- */

import { initializeRegistry }    from "../registry/dataset-registry.js";
import * as referenceService     from "../reference-service.js";
import { bindTableRowSelection } from "../_core/table-interaction-controller.js";
import { bindTableSortClicks }   from "../_core/sort-utils.js";
import { renderFilterBar }       from "../_core/filter-utils.js";

// ----------------------------
// View State (URL-driven)
// ----------------------------
const viewState = {
  appMode:    "browse",
  domain:     "spells",
  viewType:   "summary",
  renderMode: "table",
  selectedId: null,
  sort:       null,
  order:      null,
  filter:     {}
};

// ----------------------------
// URL → State
// ----------------------------
function parseURL() {
  const params = new URLSearchParams(window.location.search);

  const filter = {};

  // First pass: collect all filter_* params into raw map
  const raw = {};
  for (const [key, value] of params.entries()) {
    if (key.startsWith("filter_")) {
      raw[key.slice(7)] = value;
    }
  }

  // Second pass: collapse _min / _max suffix pairs → range objects
  const rangeFields = new Set();
  for (const key of Object.keys(raw)) {
    if (key.endsWith("_min")) rangeFields.add(key.slice(0, -4));
    if (key.endsWith("_max")) rangeFields.add(key.slice(0, -4));
  }

  for (const field of rangeFields) {
    const range = {};
    if (raw[`${field}_min`] !== undefined) range.min = Number(raw[`${field}_min`]);
    if (raw[`${field}_max`] !== undefined) range.max = Number(raw[`${field}_max`]);
    filter[field] = range;
    delete raw[`${field}_min`];
    delete raw[`${field}_max`];
  }

  // Third pass: remaining scalars — coerce booleans
  for (const [field, value] of Object.entries(raw)) {
    if (value === "true")  { filter[field] = true;  continue; }
    if (value === "false") { filter[field] = false; continue; }
    filter[field] = value;
  }

  return {
    appMode:    params.get("appMode") || "browse",
    domain:     params.get("domain")  || "spells",
    viewType:   params.get("view")    || "summary",
    renderMode: params.get("mode")    || "table",
    selectedId: params.get("id")      || null,
    sort:       params.get("sort")    || null,
    order:      params.get("order")   || null,
    filter
  };
}

// ----------------------------
// State → URL
// ----------------------------
function buildURL(state) {
  const params = new URLSearchParams();

  params.set("appMode", state.appMode);
  params.set("domain",  state.domain);
  params.set("view",    state.viewType);
  params.set("mode",    state.renderMode);

  if (state.selectedId) params.set("id", state.selectedId);

  if (state.sort) {
    params.set("sort",  state.sort);
    params.set("order", state.order || "asc");
  }

  if (state.filter && Object.keys(state.filter).length > 0) {
    for (const [field, value] of Object.entries(state.filter)) {
      if (value === null || value === undefined || value === "") continue;

      // Range object → expand to _min / _max params
      if (typeof value === "object" && !Array.isArray(value) &&
          ("min" in value || "max" in value)) {
        if (value.min !== undefined && value.min !== "") {
          params.set(`filter_${field}_min`, value.min);
        }
        if (value.max !== undefined && value.max !== "") {
          params.set(`filter_${field}_max`, value.max);
        }
        continue;
      }

      // Boolean → serialize as "true" / "false"
      if (typeof value === "boolean") {
        params.set(`filter_${field}`, String(value));
        continue;
      }

      params.set(`filter_${field}`, value);
    }
  }

  return `?${params.toString()}`;
}

// ----------------------------
// Render — Card Pane
// Renders a single entity card into #card-stack.
// Called only from renderFromState in browse+split mode.
// ----------------------------
async function renderCardPane() {
  const cardStack = document.getElementById("card-stack");
  if (!cardStack) return;

  try {
    const html = await referenceService.render({
      domain:     viewState.domain,
      viewType:   "entity",
      renderMode: "card",
      selectedId: viewState.selectedId,
      sort:       null,
      order:      null,
      filter:     {}
    });
    cardStack.innerHTML = html;
  } catch (err) {
    console.error("[CARD PANE RENDER ERROR]", err);
    cardStack.innerHTML = `<p style="color:red;">${err.message}</p>`;
  }
}

// ----------------------------
// Append Card — Stack Mode
// Appends a new entity card below existing cards in #card-stack.
// Called from bindInteractions in stack mode on each row click.
// No maximum stack depth.
// ----------------------------
async function appendCardToStack(selectedId) {
  const cardStack = document.getElementById("card-stack");
  if (!cardStack) return;

  try {
    const html = await referenceService.render({
      domain:     viewState.domain,
      viewType:   "entity",
      renderMode: "card",
      selectedId,
      sort:       null,
      order:      null,
      filter:     {}
    });

    const wrapper = document.createElement("div");
    wrapper.className = "stack-card";
    wrapper.innerHTML = html;

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "stack-card-close";
    closeBtn.textContent = "✕";
    closeBtn.addEventListener("click", () => {
      wrapper.remove();
      if (cardStack.children.length === 0) {
        const viewContainer = document.getElementById("view-container");
        if (viewContainer) viewContainer.classList.remove("split-active");
      }
    });
    wrapper.prepend(closeBtn);
    cardStack.appendChild(wrapper);

    // Activate split pane on first append
    const viewContainer = document.getElementById("view-container");
    if (viewContainer) viewContainer.classList.add("split-active");

    // Wire pane-level close button — clears entire stack
    const cardPaneClose = document.getElementById("card-pane-close");
    if (cardPaneClose) {
      const fresh = cardPaneClose.cloneNode(true);
      cardPaneClose.parentNode.replaceChild(fresh, cardPaneClose);
      fresh.addEventListener("click", () => {
        cardStack.innerHTML = "";
        if (viewContainer) viewContainer.classList.remove("split-active");
      });
    }
  } catch (err) {
    console.error("[STACK APPEND ERROR]", err);
  }
}

// ----------------------------
// Render — Main
// ----------------------------
async function renderFromState() {
  const viewContainer = document.getElementById("view-container");
  const cardStack     = document.getElementById("card-stack");
  const cardPaneClose = document.getElementById("card-pane-close");

  const isBrowseSplit =
    viewState.appMode === "browse" && viewState.selectedId !== null;

  const isStackSplit =
    viewState.appMode === "stack" && cardStack?.children.length > 0;

  const isSplitPane = isBrowseSplit || isStackSplit;

  try {
    // Always render the table into #results
    const html = await referenceService.render({
      domain:     viewState.domain,
      viewType:   viewState.viewType,
      renderMode: viewState.renderMode,
      selectedId: isSplitPane ? null : viewState.selectedId,
      sort:       viewState.sort,
      order:      viewState.order,
      filter:     viewState.filter
    });

    const container = document.getElementById("results");
    container.innerHTML = html;

    injectBackButton(container);
    bindInteractions(container);

    // Filter bar
    const filtersEl = document.getElementById("filters");
    if (filtersEl) {
      if (viewState.renderMode === "table") {
        renderFilterBar({
          container: filtersEl,
          domain:    viewState.domain,
          viewState,
          transition
        });
      } else {
        filtersEl.innerHTML = "";
      }
    }

    // Split-pane: activate layout and render card if in browse mode
    if (isSplitPane) {
      if (viewContainer) viewContainer.classList.add("split-active");
      if (isBrowseSplit) await renderCardPane();

      // Wire close button (present in DOM from initial HTML)
      if (cardPaneClose) {
        // Replace node to drop any previous listener
        const fresh = cardPaneClose.cloneNode(true);
        cardPaneClose.parentNode.replaceChild(fresh, cardPaneClose);
        fresh.addEventListener("click", () => {
          if (viewState.appMode === "stack") {
            cardStack.innerHTML = "";
            if (viewContainer) viewContainer.classList.remove("split-active");
          } else {
            transition({ selectedId: null });
          }
        });
      }
    } else {
      // Not split-pane: collapse layout, clear card pane
      if (viewContainer) viewContainer.classList.remove("split-active");
      if (cardStack)     cardStack.innerHTML = "";
    }

  } catch (err) {
    console.error("[RENDER ERROR]", err);
    document.getElementById("results").innerHTML =
      `<p style="color:red;">${err.message}</p>`;
  }
}

// ----------------------------
// Transition (URL-driven)
// ----------------------------
function transition(nextState) {
  Object.assign(viewState, nextState);
  history.pushState(null, "", buildURL(viewState));
  renderFromState();
}

// ----------------------------
// Interaction Binding
// ----------------------------
function bindInteractions(container) {
  if (viewState.renderMode === "table") {

    if (viewState.appMode === "browse") {
      // Browse mode: row click sets selectedId only.
      // viewType and renderMode stay summary/table.
      // Split-pane render is triggered by selectedId in renderFromState.
      bindTableRowSelection({
        container,
        domain: viewState.domain,
        renderReference: ({ selectedId }) => {
          transition({ selectedId });
        }
      });
    } else if (viewState.appMode === "stack") {
      // Stack mode: row click appends a card to #card-stack.
      // Does not replace existing cards.
      bindTableRowSelection({
        container,
        domain: viewState.domain,
        renderReference: ({ selectedId }) => {
          appendCardToStack(selectedId);
        }
      });
    } else if (viewState.appMode === "edit") {
      // Edit mode: row click navigates to add-edit-controller with the record id.
      // The controller reads ?domain=, ?appMode=edit, and ?id= to mount the
      // pre-populated edit form for the selected record.
      bindTableRowSelection({
        container,
        domain: viewState.domain,
        renderReference: ({ selectedId }) => {
          window.location.href =
            `?domain=spells&appMode=edit&id=${encodeURIComponent(selectedId)}`;
        }
      });
    }

    bindTableSortClicks({ container, viewState, transition });
  }
}

// ----------------------------
// Back Button (UI)
// In browse mode this is always a no-op — the close button in the
// card pane handles dismissal. Retained for manage mode parity.
// ----------------------------
function injectBackButton(container) {
  if (viewState.viewType !== "entity") return;
  const button = document.createElement("button");
  button.textContent = "Back";
  button.addEventListener("click", () => history.back());
  container.prepend(button);
}

// ----------------------------
// Browser Back/Forward
// ----------------------------
function bindPopstate() {
  window.addEventListener("popstate", () => {
    Object.assign(viewState, parseURL());
    renderFromState();
  });
}

// ----------------------------
// Init
// ----------------------------
async function init() {
  try {
    await initializeRegistry();
    Object.assign(viewState, parseURL());
    history.replaceState(null, "", buildURL(viewState));
    
        // Edit button — navigates to the edit form for this record.
        const cardPane = document.getElementById("card-pane");
        if (cardPane) {
          cardPane.addEventListener("click", e => {
            const btn = e.target.closest("[data-action='edit-record']");
            if (!btn) return;
            const id = btn.dataset.id;
            if (id) {
              window.location.href =
                `?domain=spells&appMode=edit&id=${encodeURIComponent(id)}`;
            }
          });
        }
    
        renderFromState();
  } catch (err) {
    console.error("[INIT ERROR]", err);
    document.getElementById("results").innerHTML =
      `<p style="color:red;">Failed to initialize: ${err.message}</p>`;
  }
}

// ----------------------------
// Run
// ----------------------------
export function run() {
  bindPopstate();
  init();
}
