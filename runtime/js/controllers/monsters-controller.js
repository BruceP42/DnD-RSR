/* ---------------------------------------------------------
Path: runtime/js/controllers/monsters-controller.js
File: monsters-controller.js
Version: V2.7
Data Schema: V1.1
System: D&D Reference System - Reference System Runtime (RSR)
Module/Role: Page controller for monsters reference view; manages
  URL-driven state, rendering via referenceService, and
  interaction binding for the monsters domain
Dependencies:
  - runtime/js/reference-service.js
  - runtime/js/_core/sort-utils.js
  - runtime/js/_core/filter-utils.js
  - runtime/js/_core/table-interaction-controller.js
  - runtime/js/registry/dataset-registry.js
Created: 2026-04-08
Last Updated: 2026-05-11
Author: Bruce Pilcher
Changelog:
  V2.7
    - Added edit-record click handler in init() on #card-pane. Edit button on the monster card navigates to ?domain=monsters&appMode=edit&id=<id>.
  V2.6:
    - appMode=edit renderReference stub replaced with a live navigation handler.
    - Row click navigates to ?domain=monsters&appMode=edit&id=<id>, handing off to add-edit-controller which reads the id param and mounts the edit form.
  V2.5
    - Fixed appendCardToStack: now adds split-active to #view-container and wires close button after each append; pane was silently populated but never made visible
    - appendCardToStack: added per-card close button (.stack-card-close); removes individual card on click; collapses pane when last card removed
  V2.4:
    - Renamed appMode "play" → "browse" throughout
    - Implemented appMode=stack: row clicks append cards to #card-stack
      via appendCardToStack(); no maximum stack depth
    - Added isBrowseSplit / isStackSplit split-pane logic; stack pane
      stays open while #card-stack has children
    - Stack close button clears #card-stack and collapses pane
    - Added appMode=edit routing stub in bindInteractions(); logs warning
    - Updated all "play mode" comment references to "browse mode"
  V2.3:
  - Fixed stat-block always showing first record (aboleth); selectedId was unconditionally nulled when isSplitPane, causing reference-service to call getCollection() instead of getEntity(). Fix: only null selectedId when renderMode is "table", not for stat-block or other entity renders.
    V2.2:
  - Fixed duplicate event listener bug on #card-stack;
    handler was re-added on every renderFromState() call
    causing first-registered monster to always open its
    stat-block regardless of which button was clicked.
    Fixed by cloning #card-stack before adding listener,
    matching existing cardPaneClose pattern.
  V2.1:
    - bindInteractions: added delegated click handler for
      data-action="open-stat-block" buttons emitted by card-renderer
    - Click reads data-id from button; transitions to
      viewType: "entity", renderMode: "stat-block" with that id
    - Handler scoped to #card-stack so it does not fire on table
      row clicks or other container clicks
  V2.0:
    - Added appMode to viewState (default "play")
    - parseURL reads appMode param; defaults to "play"
    - buildURL serializes appMode param
    - renderFromState: play mode + selectedId -> split-pane layout
    - renderFromState: other cases clear #card-stack, remove
      split-active class
    - bindInteractions: play mode row click sets selectedId only
    - bindInteractions: manage mode row click -> entity/card
    - renderCardPane: renders entity card into #card-stack
    - injectBackButton: no-op in play mode
  V1.2:
    - Imported renderFilterBar from filter-utils.js
    - parseURL collapses filter_<field>_min/_max into range objects
    - parseURL recognises filter_<field>=true/false as booleans
    - buildURL expands range objects back to _min/_max params
    - buildURL serializes boolean filter values as "true"/"false"
    - renderFromState calls renderFilterBar after table render
  V1.1:
    - Imported bindTableSortClicks from sort-utils.js
    - bindInteractions calls bindTableSortClicks for table view
  V1.0: Initial implementation; mirrors spells-controller.js pattern
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
  - The open-stat-block handler transitions renderMode to
    "stat-block" which causes renderFromState to render the
    stat-block into #results (left pane); the card pane
    remains visible with the card still in #card-stack until
    the user closes it
  - Range filter params: filter_<field>_min, filter_<field>_max
  - Boolean filter params: filter_<field>=true or =false
  - filter_* params namespaced to avoid collision with
    navigation params (domain, view, mode, id, appMode)
  - sort and order are always serialized together
  - Controller knows nothing about data or engines
  - Entity view defaults to card renderMode
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
  domain:     "monsters",
  viewType:   "summary",
  renderMode: "table",
  selectedId: null,
  sort:       null,
  order:      null,
  filter:     {}
};

// ----------------------------
// URL -> State
// ----------------------------
function parseURL() {
  const params = new URLSearchParams(window.location.search);

  const filter = {};

  const raw = {};
  for (const [key, value] of params.entries()) {
    if (key.startsWith("filter_")) {
      raw[key.slice(7)] = value;
    }
  }

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

  for (const [field, value] of Object.entries(raw)) {
    if (value === "true")  { filter[field] = true;  continue; }
    if (value === "false") { filter[field] = false; continue; }
    filter[field] = value;
  }

  return {
    appMode:    params.get("appMode") || "browse",
    domain:     params.get("domain")  || "monsters",
    viewType:   params.get("view")    || "summary",
    renderMode: params.get("mode")    || "table",
    selectedId: params.get("id")      || null,
    sort:       params.get("sort")    || null,
    order:      params.get("order")   || null,
    filter
  };
}

// ----------------------------
// State -> URL
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
    const isTableRender = viewState.renderMode === "table";

    const html = await referenceService.render({
      domain:     viewState.domain,
      viewType:   viewState.viewType,
      renderMode: viewState.renderMode,
      selectedId: (isSplitPane && isTableRender) ? null : viewState.selectedId,
      sort:       viewState.sort,
      order:      viewState.order,
      filter:     viewState.filter
    });

    const container = document.getElementById("results");
    container.innerHTML = html;

    injectBackButton(container);
    bindInteractions(container);

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

    if (isSplitPane) {
      if (viewContainer) viewContainer.classList.add("split-active");
      if (isBrowseSplit && viewState.renderMode === "table") await renderCardPane();

      if (cardPaneClose) {
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
            `?domain=monsters&appMode=edit&id=${encodeURIComponent(selectedId)}`;
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

    // Stat-block button — bound once at init on the static
    // #card-pane element which is never replaced; reads data-id
    // from the button at click time so always gets current card.
    const cardPane = document.getElementById("card-pane");
        if (cardPane) {
          cardPane.addEventListener("click", e => {
            const btn = e.target.closest("[data-action='open-stat-block']");
            if (!btn) return;
            const id = btn.dataset.id;
            if (id) {
              transition({
                viewType:   "entity",
                renderMode: "stat-block",
                selectedId: id
              });
            }
          });
    
          // Edit button — navigates to the edit form for this record.
          cardPane.addEventListener("click", e => {
            const btn = e.target.closest("[data-action='edit-record']");
            if (!btn) return;
            const id = btn.dataset.id;
            if (id) {
              window.location.href =
                `?domain=monsters&appMode=edit&id=${encodeURIComponent(id)}`;
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
