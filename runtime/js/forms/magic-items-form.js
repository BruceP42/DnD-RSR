/* ---------------------------------------------------------
   Path:         runtime/js/forms/magic-items-form.js
   File:         magic-items-form.js
   Version:      V1.3
   Data Schema:  magic item record (pipeline raw + runtime dataset)
   System:       DnD-RSR — D&D 5e Dynamic Reference System
   Module/Role:  Add/edit form for magic item records
   Dependencies: runtime/js/forms/form-utils.js
                 runtime/js/_core/domain-config.js
   Created:      2026-05-04
   Last Updated: 2026-06-07
--------------------------------------------------------- */
/* Changelog:
   V1.3:
   - mountMagicItemsForm is now async.
   - Imports loadDomainConfig from domain-config.js.
   - Removed module-level CATEGORIES and RARITIES constants.
   - Category and rarity option values loaded from
     domain-config.js at mount time via getValues(). Falls back
     to inline defaults if config returns null (e.g. missing file).
   - Fallback RARITIES corrected to include 'Varies' first,
     matching the canonical config order.
   - _populateForm() matching logic unchanged — works identically
     with config-supplied Title Case values.
   V1.2:
   - Imports buildSortedSourceOptions, assertValid, toTitleCase, and
     makeBeforeUnloadGuard from form-utils.js.
   - Beforeunload guard replaced with makeBeforeUnloadGuard() factory.
   - Source select now built via buildSortedSourceOptions() — options
     are sorted A–Z by name; "Homebrew (no source)" remains last.
   - Validation chain replaced with assertValid([...]).
   - mountMagicItemsForm now accepts an optional initialValues object in
     its options parameter. When provided the form mounts in edit mode:
     _populateForm() pre-fills every field from the runtime record, the
     primary source select is disabled (source encoded in id cannot change),
     and an Additional Sources section is injected below the source/page row
     so the user can add or remove supplementary source entries.
   - form[data-mode] set to "add" or "edit" for CSS targeting.
   - Save button reads "Save Changes" in edit mode, "Save Magic Item" in
     add mode.
   - _getFormData now reads .mif-additional-source-row elements and returns
     an additionalSources array. Empty array in add mode (rows not present).
   V1.1:
   - Converted module-level _root/_els state to closure-based state inside
     mountMagicItemsForm. Public API is now
     mountMagicItemsForm(container, options, onSubmit) → teardown, matching
     the pattern used by monsters-form.js. getMagicItemsFormData and
     resetMagicItemsForm are now private closure functions; form validates
     and calls onSubmit(data) via an internal submit button.
   - Added beforeunload guard: set on first input event, cleared on teardown
     and on successful submit.
   V1.0:
   - Initial creation. Provides mountMagicItemsForm, getMagicItemsFormData,
     and resetMagicItemsForm. Page field hidden when source is "homebrew".
*/

import {
  buildSortedSourceOptions,
  assertValid,
  toTitleCase,
  makeBeforeUnloadGuard,
} from './form-utils.js';

import { loadDomainConfig } from '../_core/domain-config.js';

// ── Fallback vocab lists ───────────────────────────────────────────────────
//
// Used only when domain-config.js returns null (e.g. config file missing).
// Values are Title Case to match the pipeline raw file format.
// RARITIES includes 'Varies' first — matches canonical config order.

const FALLBACK_CATEGORIES = [
  'Armor',
  'Potion',
  'Ring',
  'Rod',
  'Scroll',
  'Staff',
  'Wand',
  'Weapon',
  'Wondrous Item',
];

const FALLBACK_RARITIES = [
  'Varies',
  'Common',
  'Uncommon',
  'Rare',
  'Very Rare',
  'Legendary',
  'Artifact',
];

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Renders the magic items form into `container`, replacing any existing content.
 * All state is held in closure — multiple independent mounts do not share state.
 *
 * The form renders a submit button. When clicked it validates the current
 * values, displays any validation error inline, and on success calls
 * onSubmit(data). If onSubmit throws (e.g. a writer error), the error
 * message is displayed and the button is re-enabled.
 *
 * @param {HTMLElement} container
 * @param {Object}      options
 * @param {Array}       [options.sources=[]]        - Records from sources-dataset.js.
 *                        Each must have at least { id, name }. Sorted A–Z.
 *                        The "homebrew" option is appended automatically.
 * @param {object|null} [options.initialValues=null] - Runtime magic item record to
 *                        pre-populate. When provided the form mounts in edit mode:
 *                        primary source disabled, additional sources section injected,
 *                        button reads "Save Changes".
 * @param {Function}    [onSubmit] - Async callback receiving the validated
 *                        form data object. May be omitted in test contexts.
 * @returns {Promise<Function>} teardown — clears the beforeunload guard and empties
 *                        the container. Call when unmounting the form.
 */
export async function mountMagicItemsForm(
  container,
  { sources = [], initialValues = null } = {},
  onSubmit,
) {
  const isEdit = initialValues !== null;

  // ── Load controlled vocabularies from domain config ──────────────────────
  // Falls back to inline defaults if config file is missing or returns null.
  const cfg        = await loadDomainConfig('magic-items');
  const CATEGORIES = cfg.getValues('magic_item_category') ?? FALLBACK_CATEGORIES;
  const RARITIES   = cfg.getValues('rarity')              ?? FALLBACK_RARITIES;

  // ── Closure state ────────────────────────────────────────────────────────
  let root = container;
  let els  = {};

  // ── Render ───────────────────────────────────────────────────────────────
  root.innerHTML = _buildHTML(sources, isEdit, CATEGORIES, RARITIES);

  // Mark form element so CSS can target add vs edit mode
  const formEl = root.querySelector('#magic-items-form');
  formEl.dataset.mode = isEdit ? 'edit' : 'add';

  _cacheRefs();
  _attachListeners();

  // Pre-populate all fields when editing an existing record.
  // Programmatic .value assignment does not fire 'input', so the
  // beforeunload guard is not armed during population.
  if (isEdit) {
    _populateForm();
  }

  // ── beforeunload guard ───────────────────────────────────────────────────
  const guard = makeBeforeUnloadGuard();
  root.addEventListener('input', guard.arm, { once: true });

  // ── Element cache ────────────────────────────────────────────────────────
  function _cacheRefs() {
    const q = id => root.querySelector(`#${id}`);
    els = {
      name:       q('mif-name'),
      category:   q('mif-category'),
      rarity:     q('mif-rarity'),
      attunement: q('mif-attunement'),
      source:     q('mif-source'),
      page:       q('mif-page'),
      pageField:  q('mif-page-field'),
      desc:       q('mif-desc'),
      submitBtn:  q('mif-submit'),
      errorEl:    q('mif-error'),
    };
  }

  // ── Event listeners ──────────────────────────────────────────────────────
  function _attachListeners() {
    // Hide page field when "homebrew" is selected — homebrew has no page number
    els.source.addEventListener('change', () => {
      const isHomebrew = els.source.value === 'homebrew';
      els.pageField.style.display = isHomebrew ? 'none' : '';
      if (isHomebrew) els.page.value = '';
    });

    // Submit
    els.submitBtn.addEventListener('click', async () => {
      els.errorEl.textContent = '';
      let data;
      try {
        data = _getFormData();
      } catch (msg) {
        els.errorEl.textContent = msg;
        return;
      }
      els.submitBtn.disabled = true;
      try {
        await onSubmit?.(data);
        guard.disarm();
      } catch (err) {
        els.errorEl.textContent = err.message ?? String(err);
      } finally {
        els.submitBtn.disabled = false;
      }
    });
  }

  // ── Form data reader ─────────────────────────────────────────────────────

  /**
   * Reads and validates the form. Returns a plain data object on success.
   * Throws a human-readable string message on validation failure.
   *
   * Returned shape:
   * {
   *   name:              string,
   *   category:          string  (Title Case, e.g. 'Wondrous Item'),
   *   rarity:            string  (Title Case, e.g. 'Very Rare'),
   *   attunement:        boolean,
   *   desc:              string[]  (one element per paragraph),
   *   source:            string    (source ID, e.g. 'hcs' or 'homebrew'),
   *   page:              string | null,
   *   additionalSources: Array<{ source: string, page: string|null }>,
   * }
   */
  function _getFormData() {
    const name       = els.name.value.trim();
    const category   = els.category.value;
    const rarity     = els.rarity.value;
    const attunement = els.attunement.checked;
    const source     = els.source.value;
    const page       = els.page.value.trim() || null;

    const desc = els.desc.value
      .trim()
      .split(/\n{2,}/)
      .map(p => p.trim())
      .filter(Boolean);

    // Additional sources — only present in edit mode; empty array in add mode
    const additionalSources = [];
    root.querySelectorAll('.mif-additional-source-row').forEach(row => {
      const src  = row.querySelector('.mif-additional-source-select')?.value;
      const pg   = row.querySelector('.mif-additional-source-page')?.value.trim() || null;
      if (src) additionalSources.push({ source: src, page: pg });
    });

    assertValid([
      [!!name,           'Name is required.'        ],
      [!!category,       'Category is required.'    ],
      [!!rarity,         'Rarity is required.'      ],
      [desc.length > 0,  'Description is required.' ],
      [!!source,         'Source is required.'      ],
    ]);

    return { name, category, rarity, attunement, desc, source, page, additionalSources };
  }

  // ── Edit-mode population ─────────────────────────────────────────────────

  /**
   * Pre-fills every form field from the runtime magic item record (initialValues).
   * Called only in edit mode, immediately after _attachListeners.
   * Programmatic .value assignments do not fire 'input', so the
   * beforeunload guard is not armed during this call.
   */
  function _populateForm() {
    const iv = initialValues;

    // Name — stored lowercase in runtime; convert to title case for display
    els.name.value = toTitleCase(iv.name ?? '');

    // Category — runtime stores lowercased; match against Title Case options
    // by finding the option whose lowercased value equals the stored value
    const storedCategory = (iv.magic_item_category ?? '').toLowerCase();
    const categoryMatch  = CATEGORIES.find(c => c.toLowerCase() === storedCategory);
    els.category.value   = categoryMatch ?? iv.magic_item_category ?? '';

    // Rarity — same Title Case matching strategy as category
    const storedRarity = (iv.rarity ?? '').toLowerCase();
    const rarityMatch  = RARITIES.find(r => r.toLowerCase() === storedRarity);
    els.rarity.value   = rarityMatch ?? iv.rarity ?? '';

    // Attunement
    els.attunement.checked = !!iv.attunement;

    // Description — runtime stores as array; join with blank line for textarea
    els.desc.value = (iv.item_desc ?? []).join('\n\n');

    // Primary source — disable; fire change to handle page field visibility
    els.source.value    = iv.sources?.[0]?.source ?? '';
    els.source.disabled = true;
    els.source.dispatchEvent(new Event('change'));

    // Primary page — stored as string or number; blank if absent
    const rawPage  = iv.sources?.[0]?.page;
    els.page.value = (rawPage == null || rawPage === 'N/A') ? '' : String(rawPage);

    // Inject additional sources section below the source/page row
    _injectAdditionalSourcesSection(iv.sources ?? []);
  }

  /**
   * Creates and inserts the Additional Sources section after the
   * source/page form-row. Pre-populates from existingSources (sources[1..]).
   *
   * @param {Array} existingSources - Full sources array from the runtime record.
   */
  function _injectAdditionalSourcesSection(existingSources) {
    const sourceRow = els.source.closest('.form-row') ?? els.source.closest('.form-field');
    if (!sourceRow) return;

    const section = document.createElement('div');
    section.className = 'form-section mif-additional-sources';
    section.innerHTML = `
      <p class="section-label">Additional Sources</p>
      <p class="field-hint">The primary source cannot be changed. Add other books
        or supplements where this item also appears.</p>
      <div id="mif-additional-sources-rows"></div>
      <button type="button" id="mif-add-additional-source">+ Add Source</button>
    `;
    sourceRow.after(section);

    // Pre-fill from sources[1..]
    for (const src of existingSources.slice(1)) {
      _addAdditionalSourceRow(src);
    }

    section.querySelector('#mif-add-additional-source')
      ?.addEventListener('click', () => _addAdditionalSourceRow(null));
  }

  /**
   * Appends one additional-source row (select + page input + Remove button).
   * Optionally pre-fills from an existing { source, page } object.
   *
   * @param {object|null} existing - { source, page } or null for a blank row.
   */
  function _addAdditionalSourceRow(existing) {
    const rowsEl = root.querySelector('#mif-additional-sources-rows');
    if (!rowsEl) return;

    const row = document.createElement('div');
    row.className = 'mif-additional-source-row form-row';
    row.innerHTML = `
      <div class="form-field">
        <select class="mif-additional-source-select">
          ${buildSortedSourceOptions(sources)}
        </select>
      </div>
      <div class="form-field">
        <input type="text" class="mif-additional-source-page"
               placeholder="Page" autocomplete="off">
      </div>
      <button type="button" class="remove-row-btn">Remove</button>
    `;

    if (existing?.source) {
      row.querySelector('.mif-additional-source-select').value = existing.source;
    }
    const rawPage = existing?.page;
    if (rawPage != null && rawPage !== 'N/A') {
      row.querySelector('.mif-additional-source-page').value = String(rawPage);
    }

    row.querySelector('.remove-row-btn')
      .addEventListener('click', () => row.remove());

    rowsEl.appendChild(row);
  }

  // ── Teardown ─────────────────────────────────────────────────────────────

  function teardown() {
    guard.disarm();
    if (root) {
      root.innerHTML = '';
      root = null;
    }
    els = {};
  }

  return teardown;
}

// ── Internal: HTML builder ─────────────────────────────────────────────────

/**
 * @param {Array}   sources    - Source records { id, name } — sorted A–Z in output.
 * @param {boolean} isEdit     - True when mounting in edit mode.
 * @param {Array}   categories - Category values from config or fallback.
 * @param {Array}   rarities   - Rarity values from config or fallback.
 */
function _buildHTML(sources, isEdit, categories, rarities) {
  const categoryOptions = [
    '<option value="">— select —</option>',
    ...categories.map(c => `<option value="${c}">${c}</option>`),
  ].join('\n            ');

  const rarityOptions = [
    '<option value="">— select —</option>',
    ...rarities.map(r => `<option value="${r}">${r}</option>`),
  ].join('\n            ');

  const sourceOptions = buildSortedSourceOptions(sources);

  const submitLabel = isEdit ? 'Save Changes' : 'Save Magic Item';

  return `<form id="magic-items-form" novalidate>

      <div class="form-field">
        <label for="mif-name">Name <span class="required">*</span></label>
        <input type="text" id="mif-name" autocomplete="off">
      </div>

      <div class="form-row">
        <div class="form-field">
          <label for="mif-category">Category <span class="required">*</span></label>
          <select id="mif-category">
            ${categoryOptions}
          </select>
        </div>
        <div class="form-field">
          <label for="mif-rarity">Rarity <span class="required">*</span></label>
          <select id="mif-rarity">
            ${rarityOptions}
          </select>
        </div>
      </div>

      <div class="form-field">
        <label>Attunement</label>
        <div class="checkbox-group inline">
          <label class="checkbox-label">
            <input type="checkbox" id="mif-attunement"> Requires attunement
          </label>
        </div>
        <p class="field-hint">
          If attunement is restricted to a class, race, or alignment,
          include that detail in the description.
        </p>
      </div>

      <div class="form-row">
        <div class="form-field">
          <label for="mif-source">Source <span class="required">*</span></label>
          <select id="mif-source">
            ${sourceOptions}
          </select>
        </div>
        <div class="form-field" id="mif-page-field">
          <label for="mif-page">Page</label>
          <input type="text" id="mif-page" autocomplete="off"
                 placeholder="e.g. 101">
        </div>
      </div>

      <div class="form-field">
        <label for="mif-desc">Description <span class="required">*</span></label>
        <p class="field-hint">Separate paragraphs with a blank line.</p>
        <textarea id="mif-desc" rows="12"></textarea>
      </div>

      <p id="mif-error" class="form-error" aria-live="polite"></p>
      <button type="button" id="mif-submit" class="btn-primary">${submitLabel}</button>

    </form>`;
}
