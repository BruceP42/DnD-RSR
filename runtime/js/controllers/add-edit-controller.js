/* ---------------------------------------------------------
   Path:         runtime/js/controllers/add-edit-controller.js
   File:         add-edit-controller.js
   Version:      V1.3
   Data Schema:  N/A
   System:       D&D Reference System – RSR
   Module/Role:  Controller — appMode=edit; mounts domain-specific add/edit forms, dispatches to the appropriate writer on submit, and manages the success/post-save state.
   Dependencies:
     - runtime/js/forms/spells-form.js
     - runtime/js/forms/magic-items-form.js
     - runtime/js/forms/monsters-form.js
     - runtime/js/forms/sources-form.js
     - runtime/js/writers/spells-writer.js      (dynamic import)
     - runtime/js/writers/magic-items-writer.js (dynamic import)
     - runtime/js/writers/monsters-writer.js    (dynamic import)
     - runtime/js/writers/sources-writer.js     (dynamic import)
     - runtime/data/sources-dataset.js          (dynamic import)
     - runtime/data/<domain>-dataset.js         (dynamic import, edit mode only)
   Created:      2026-05-09
   Last Updated: 2026-05-15
--------------------------------------------------------- */
/* Changelog:
   V1.3:
    - magic-items case in _getWriter() now returns updateMagicItem in edit mode following implementation of updateMagicItem in V1.4 of magic-items-writer.js. Fallback comment removed.
   V1.2:
   - run() now reads the ?id= URL param. When present, the controller mounts in edit mode: _loadRecord() dynamically imports the domain dataset and finds the matching record by id, then passes it to _mountEditPage() as existingId/initialValues.
   - _mountEditPage() gains an optional existingId parameter (default null). When non-null: heading reads "— Edit", the page wrapper carries data-mode="edit", _loadRecord() is awaited for initialValues, and onSubmit calls the update writer with (data, existingId).
   - _getWriter() now accepts an isEdit boolean and returns the update function (updateSpell, updateMonster, etc.) or the write function accordingly. Block-scoped cases added to permit const declarations.
   - _mountForm() gains an initialValues parameter passed to all four form mount functions via the options object.
   - _showSuccessPanel() gains an isEdit parameter. In edit mode: message reads "updated" instead of "saved"; "Add another" button is suppressed; only "Back to reference" is shown.
   - _loadRecord() added: dynamically imports the domain runtime dataset and returns the matching record object, or throws if not found.
   V1.1:
   - _mountForm() monsters case updated from mountMonstersForm(formContainer, onSubmit) to mountMonstersForm(formContainer, { sources }, onSubmit) — aligns with the signature change in monsters-form.js V1.5. JSDoc comment updated accordingly.
   V1.0:
   - Initial creation. Reads ?domain= param, mounts the matching form, dispatches to the matching writer, and shows a success panel with "Add another" and "Back to reference" actions.
   - Domain-select landing rendered when ?domain= is absent or invalid.
   - Teardown tracked and called before every remount or navigation.
*/

import { mountSpellsForm }     from '../forms/spells-form.js';
import { mountMagicItemsForm } from '../forms/magic-items-form.js';
import { mountMonstersForm }   from '../forms/monsters-form.js';
import { mountSourcesForm }    from '../forms/sources-form.js';

// ── Constants ──────────────────────────────────────────────────────────────

const VALID_DOMAINS = ['spells', 'magic-items', 'monsters', 'sources'];

const DOMAIN_LABELS = {
  spells:        'Spells',
  'magic-items': 'Magic Items',
  monsters:      'Monsters',
  sources:       'Sources',
};

// ── Teardown tracking ──────────────────────────────────────────────────────

let _currentTeardown = null;

function _callTeardown() {
  if (_currentTeardown) {
    _currentTeardown();
    _currentTeardown = null;
  }
}

// ── Page structure helpers ─────────────────────────────────────────────────

/**
 * Returns the main content container (#results).
 * The edit controller renders its entire UI into this element,
 * replacing the browse/stack split-pane content.
 */
function _getContainer() {
  return document.getElementById('results');
}

/** Clear the filter bar — edit mode has no filter UI. */
function _clearFilters() {
  const el = document.getElementById('filters');
  if (el) el.innerHTML = '';
}

/** Collapse the split-pane layout left over from browse/stack mode. */
function _collapseSplitPane() {
  const vc = document.getElementById('view-container');
  if (vc) vc.classList.remove('split-active');
  const cs = document.getElementById('card-stack');
  if (cs) cs.innerHTML = '';
}

// ── Sources dataset ────────────────────────────────────────────────────────

/**
 * Dynamically imports the sources dataset.
 * Returns an array of source records on success, empty array on failure.
 * Tries named export 'sources' first, then default export.
 */
async function _loadSources() {
  try {
    const mod = await import('../../data/sources-dataset.js');
    if (Array.isArray(mod.sources))  return mod.sources;
    if (Array.isArray(mod.default))  return mod.default;
    return [];
  } catch (err) {
    console.warn('[add-edit-controller] Could not load sources-dataset.js:', err.message);
    return [];
  }
}

// ── Record loader (edit mode) ──────────────────────────────────────────────

/**
 * Dynamically imports the runtime dataset for the given domain and returns
 * the record whose id matches the given id string.
 *
 * Note: dynamic imports are cached by the browser module system. If a record
 * was written in the same session and the module was already cached, the
 * imported dataset may be stale. The typical workflow — browse table row
 * click → navigate → edit — loads the dataset fresh on first import.
 *
 * @param {string} domain     - Validated domain string.
 * @param {string} existingId - The record id to locate.
 * @returns {Promise<object>} The matching runtime record.
 * @throws {Error} If the import fails or the id is not found.
 */
async function _loadRecord(domain, existingId) {
  let mod;
  try {
    mod = await import(`../../data/${domain}-dataset.js`);
  } catch (err) {
    throw new Error(
      `Could not import the ${domain} dataset: ${err.message}`
    );
  }

  const dataset = Array.isArray(mod.default)   ? mod.default
                : Array.isArray(mod[domain])    ? mod[domain]
                : [];

  const record = dataset.find(r => r.id === existingId);
  if (!record) {
    throw new Error(
      `No ${domain} record with id "${existingId}" was found in the dataset. ` +
      `The record may have been deleted, or the id in the URL is incorrect.`
    );
  }
  return record;
}

// ── Writer dispatch ────────────────────────────────────────────────────────

/**
 * Dynamically imports the writer module for the given domain and returns
 * either the write function (add mode) or the update function (edit mode).
 *
 * Add-mode function signatures:
 *   writeSpell(data)      → id string
 *   writeMagicItem(data)  → { id }
 *   writeMonster(data)    → { id }
 *   writeSource(data)     → { id }
 *
 * Edit-mode function signatures:
 *   updateSpell(data, existingId)      → { id }
 *   updateMonster(data, existingId)    → { id }
 *   (magic-items and sources edit not yet implemented)
 *
 * @param {string}  domain
 * @param {boolean} isEdit
 * @returns {Promise<Function>}
 */
async function _getWriter(domain, isEdit) {
  switch (domain) {
    case 'spells': {
      const mod = await import('../writers/spells-writer.js');
      return isEdit ? mod.updateSpell : mod.writeSpell;
    }
    case 'magic-items': {
          const mod = await import('../writers/magic-items-writer.js');
          return isEdit ? mod.updateMagicItem : mod.writeMagicItem;
        }
    case 'monsters': {
      const mod = await import('../writers/monsters-writer.js');
      return isEdit ? mod.updateMonster : mod.writeMonster;
    }
    case 'sources': {
      const mod = await import('../writers/sources-writer.js');
      // updateSource not yet implemented — fall back to write in edit mode
      return mod.writeSource;
    }
  }
}

// ── Form mounting ──────────────────────────────────────────────────────────

/**
 * Mounts the appropriate form into formContainer.
 * Returns the teardown function from the mounted form.
 *
 * All four domain forms share the same options-object signature:
 *   mountXxxForm(container, { sources, initialValues }, onSubmit)
 *
 * sources-form ignores both sources and initialValues; they are passed
 * for consistency so this function needs no special case per domain.
 *
 * @param {HTMLElement}  formContainer
 * @param {string}       domain
 * @param {Array}        sources        - Source records loaded from sources-dataset.js.
 * @param {object|null}  initialValues  - Runtime record for edit mode, null for add mode.
 * @param {Function}     onSubmit
 * @returns {Function} teardown
 */
function _mountForm(formContainer, domain, sources, initialValues, onSubmit) {
  switch (domain) {
    case 'spells':
      return mountSpellsForm(formContainer, { sources, initialValues }, onSubmit);
    case 'magic-items':
      return mountMagicItemsForm(formContainer, { sources, initialValues }, onSubmit);
    case 'monsters':
      return mountMonstersForm(formContainer, { sources, initialValues }, onSubmit);
    case 'sources':
      return mountSourcesForm(formContainer, onSubmit);
  }
}

// ── Domain picker (landing when domain param is absent / invalid) ──────────

function _showDomainPicker(container) {
  container.innerHTML = `
<div class="edit-domain-picker">
  <h2>Add a Record</h2>
  <p>Choose a domain to add a new entry:</p>
  <nav class="edit-domain-nav">
    <a href="?domain=spells&appMode=edit"       class="btn-primary">Spell</a>
    <a href="?domain=magic-items&appMode=edit"  class="btn-primary">Magic Item</a>
    <a href="?domain=monsters&appMode=edit"     class="btn-primary">Monster</a>
    <a href="?domain=sources&appMode=edit"      class="btn-primary">Source</a>
  </nav>
</div>`;
}

// ── Success panel ──────────────────────────────────────────────────────────

/**
 * Replaces the container content with a post-save success panel.
 *
 * Add mode: offers "Add another" (remounts a fresh form) and
 *           "Back to reference".
 * Edit mode: offers only "Back to reference" — "Add another" is suppressed.
 *
 * @param {HTMLElement} container  - The top-level edit container (#results).
 * @param {string}      domain
 * @param {object}      result     - Return value from the writer (should include .id).
 * @param {object}      data       - Submitted form data (used as fallback for display).
 * @param {Array}       sources    - Already-loaded sources list, forwarded to "Add another".
 * @param {boolean}     isEdit     - True when the save was an update, false for a new add.
 */
function _showSuccessPanel(container, domain, result, data, sources, isEdit = false) {
  const savedId   = result?.id   ?? null;
  const savedName = data?.name   ?? null;
  const idLine    = savedId
    ? `ID: <strong>${savedId}</strong>`
    : savedName
      ? `Name: <strong>${savedName}</strong>`
      : '';

  const action    = isEdit ? 'updated' : 'saved';
  const browseUrl = `?domain=${domain}&view=summary&mode=table&appMode=browse`;

  const addAnotherBtn = isEdit ? '' :
    `<button type="button" id="edit-add-another" class="btn-primary">Add another</button>`;

  container.innerHTML = `
<div class="edit-success-panel">
  <p class="edit-success-msg">
    ✓ ${DOMAIN_LABELS[domain] ?? domain} record ${action}.${idLine ? ' ' + idLine : ''}
  </p>
  <div class="edit-success-actions">
    ${addAnotherBtn}
    <a href="${browseUrl}" class="btn-secondary">Back to reference</a>
  </div>
</div>`;

  if (!isEdit) {
    document.getElementById('edit-add-another').addEventListener('click', () => {
      _mountEditPage(container, domain, sources, null);
    });
  }
}

// ── Main edit page ─────────────────────────────────────────────────────────

/**
 * Renders the add or edit page for a specific domain.
 *
 * Add mode (existingId is null):
 *   Loads sources, builds the heading "— Add New", mounts a blank form,
 *   wires onSubmit → write writer.
 *
 * Edit mode (existingId is a string):
 *   Loads sources and the existing record, builds the heading "— Edit",
 *   mounts a pre-populated form, wires onSubmit → update writer.
 *   The page wrapper carries data-mode="edit" for CSS targeting.
 *
 * @param {HTMLElement}  container       - Top-level container (#results).
 * @param {string}       domain          - Validated domain string.
 * @param {Array|null}   [cachedSources] - Pass already-loaded sources to
 *                         avoid a second round-trip on "Add another".
 * @param {string|null}  [existingId]    - Record id for edit mode, null for add mode.
 */
async function _mountEditPage(container, domain, cachedSources, existingId = null) {
  const isEdit = existingId !== null;

  _callTeardown();
  container.innerHTML = '<p class="edit-loading">Loading\u2026</p>';

  // Load sources (always needed for source selects)
  const sources = cachedSources ?? await _loadSources();

  // Load the existing record in edit mode
  let initialValues = null;
  if (isEdit) {
    try {
      initialValues = await _loadRecord(domain, existingId);
    } catch (err) {
      container.innerHTML = `
<div class="edit-error">
  <p>&#9888; Could not load record for editing.</p>
  <p class="edit-error-detail">${err.message}</p>
  <a href="?domain=${domain}&view=summary&mode=table&appMode=browse"
     class="btn-secondary">Back to reference</a>
</div>`;
      return;
    }
  }

  // Build page shell
  const headingText = isEdit
    ? `${DOMAIN_LABELS[domain] ?? domain} \u2014 Edit`
    : `${DOMAIN_LABELS[domain] ?? domain} \u2014 Add New`;

  container.innerHTML = `
<div class="edit-page" data-mode="${isEdit ? 'edit' : 'add'}">
  <div class="edit-page-header">
    <h2>${headingText}</h2>
    <a href="?domain=${domain}&view=summary&mode=table&appMode=browse"
       class="edit-back-link">&#8592; Back to reference</a>
  </div>
  <div id="edit-form-host"></div>
</div>`;

  const formHost = container.querySelector('#edit-form-host');

  const onSubmit = async (data) => {
    const writer = await _getWriter(domain, isEdit);
    const result = isEdit
      ? await writer(data, existingId)
      : await writer(data);
    // Reached only on success — forms re-throw errors to display inline.
    _callTeardown();
    _showSuccessPanel(container, domain, result, data, sources, isEdit);
  };

  _currentTeardown = _mountForm(formHost, domain, sources, initialValues, onSubmit);
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Entry point called by reference.html when appMode=edit.
 *
 * Reads ?domain= and ?id= params from the current URL.
 *
 * If domain is absent or invalid: renders the domain-select landing page.
 * If domain is valid and id is absent: mounts the add form (add mode).
 * If domain is valid and id is present: mounts the pre-populated form (edit mode).
 */
export function run() {
  _clearFilters();
  _collapseSplitPane();

  const container = _getContainer();
  const params    = new URLSearchParams(location.search);
  const domain    = params.get('domain') ?? '';
  const id        = params.get('id')     ?? null;

  if (!VALID_DOMAINS.includes(domain)) {
    _showDomainPicker(container);
    return;
  }

  _mountEditPage(container, domain, null, id);
}
