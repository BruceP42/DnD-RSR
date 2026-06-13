/* ---------------------------------------------------------
   Path:         runtime/js/forms/spells-form.js
   File:         spells-form.js
   Version:      V1.3
   Data Schema:  spell record (pipeline raw + runtime dataset)
   System:       D&D Reference System (RSR)
   Module/Role:  Add/edit form for spell records
   Dependencies: runtime/js/forms/form-utils.js
   Created:      2026-05-04
   Last Updated: 2026-05-10
--------------------------------------------------------- */
/* Changelog:
   V1.3:
   - Imports buildSortedSourceOptions, assertValid, toTitleCase, and
     makeBeforeUnloadGuard from form-utils.js. Local _buildSortedSourceOptions
     and _toTitleCase removed; all call sites updated.
   - Beforeunload guard replaced with makeBeforeUnloadGuard() factory.
   - Validation chain in _getFormData replaced with assertValid([...]).
   V1.2:
   - mountSpellsForm now accepts an optional initialValues object in its
     options parameter. When provided the form mounts in edit mode:
     _populateForm() pre-fills every field from the runtime record, the
     primary source select is disabled (source encoded in id cannot change),
     and an Additional Sources section is injected below the source/page row
     so the user can add or remove supplementary source entries.
   - Sources dropdown (primary and additional rows) is now sorted
     alphabetically by source name via _buildSortedSourceOptions().
   - form[data-mode] set to "add" or "edit" for CSS targeting.
   - Save button reads "Save Changes" in edit mode, "Save Spell" in add mode.
   - _getFormData now reads .sf-additional-source-row elements and returns
     an additionalSources array. Empty array in add mode (rows not present).
   - New helpers: _buildSortedSourceOptions, _addAdditionalSourceRow,
     _toTitleCase (all module-level). _populateForm is a closure function
     inside mountSpellsForm so it can access els without parameter passing.
   V1.1:
   - Converted module-level _root/_els state to closure-based state inside
     mountSpellsForm. Public API is now mountSpellsForm(container, options,
     onSubmit) → teardown, matching the pattern used by monsters-form.js.
     getSpellsFormData and resetSpellsForm are now private closure functions;
     form validates and calls onSubmit(data) via an internal submit button.
   - Added beforeunload guard: set on first input event, cleared on teardown
     and on successful submit.
   V1.0:
   - Initial creation. Provides mountSpellsForm, getSpellsFormData,
     and resetSpellsForm. Material field shown/hidden by M component
     checkbox. Page field hidden when source is "homebrew".
*/

import {
  buildSortedSourceOptions,
  assertValid,
  toTitleCase,
  makeBeforeUnloadGuard,
} from './form-utils.js';

// ── Constants ──────────────────────────────────────────────────────────────

const SCHOOLS = [
  'Abjuration', 'Conjuration', 'Divination', 'Enchantment',
  'Evocation', 'Illusion', 'Necromancy', 'Transmutation',
];

const CLASSES = [
  'Barbarian', 'Bard', 'Cleric', 'Druid', 'Fighter', 'Monk',
  'Paladin', 'Ranger', 'Rogue', 'Sorcerer', 'Warlock', 'Wizard',
];

const LEVELS = [
  { value: 0, label: '0 — Cantrip' },
  { value: 1, label: '1st'         },
  { value: 2, label: '2nd'         },
  { value: 3, label: '3rd'         },
  { value: 4, label: '4th'         },
  { value: 5, label: '5th'         },
  { value: 6, label: '6th'         },
  { value: 7, label: '7th'         },
  { value: 8, label: '8th'         },
  { value: 9, label: '9th'         },
];

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Renders the spells form into `container`, replacing any existing content.
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
 * @param {object|null} [options.initialValues=null] - Runtime spell record to
 *                        pre-populate. When provided the form mounts in edit
 *                        mode: primary source disabled, additional sources
 *                        section injected, button reads "Save Changes".
 * @param {Function}    [onSubmit] - Async callback receiving the validated
 *                        form data object. May be omitted in test contexts.
 * @returns {Function}  teardown — clears the beforeunload guard and empties
 *                        the container. Call when unmounting the form.
 */
export function mountSpellsForm(
  container,
  { sources = [], initialValues = null } = {},
  onSubmit,
) {
  const isEdit = initialValues !== null;

  // ── Closure state ────────────────────────────────────────────────────────
  let root = container;
  let els  = {};

  // ── Render ───────────────────────────────────────────────────────────────
  root.innerHTML = _buildHTML(sources, isEdit);

  // Mark form element so CSS can target add vs edit mode
  const formEl = root.querySelector('#spells-form');
  formEl.dataset.mode = isEdit ? 'edit' : 'add';

  _cacheRefs();
  _attachListeners();

  // Pre-populate and inject additional sources section in edit mode.
  // This must happen AFTER _attachListeners so that change events fired
  // during population (M checkbox, source select) are handled correctly.
  // Programmatic .value assignment does not fire 'input', so the
  // beforeunload guard is not armed during population.
  if (isEdit) {
    _populateForm();
  }

  // ── beforeunload guard ───────────────────────────────────────────────────
  // Armed on first real user input event (not fired by programmatic sets).
  const guard = makeBeforeUnloadGuard();
  root.addEventListener('input', guard.arm, { once: true });

  // ── Element cache ────────────────────────────────────────────────────────
  function _cacheRefs() {
    const q = id => root.querySelector(`#${id}`);
    els = {
      name:          q('sf-name'),
      level:         q('sf-level'),
      school:        q('sf-school'),
      castingTime:   q('sf-casting-time'),
      range:         q('sf-range'),
      duration:      q('sf-duration'),
      concentration: q('sf-concentration'),
      ritual:        q('sf-ritual'),
      compV:         q('sf-comp-v'),
      compS:         q('sf-comp-s'),
      compM:         q('sf-comp-m'),
      material:      q('sf-material'),
      materialField: q('sf-material-field'),
      source:        q('sf-source'),
      page:          q('sf-page'),
      pageField:     q('sf-page-field'),
      desc:          q('sf-desc'),
      classChecks:   [...root.querySelectorAll('.sf-class')],
      submitBtn:     q('sf-submit'),
      errorEl:       q('sf-error'),
    };
  }

  // ── Event listeners ──────────────────────────────────────────────────────
  function _attachListeners() {
    // Show/hide material field based on M component checkbox
    els.compM.addEventListener('change', () => {
      const show = els.compM.checked;
      els.materialField.style.display = show ? '' : 'none';
      if (!show) els.material.value = '';
    });

    // Hide page field when "homebrew" is selected
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
   *   level:             number  (0–9),
   *   school:            string,
   *   casting_time:      string,
   *   range:             string,
   *   components:        string[]  (subset of ['V', 'S', 'M']),
   *   material:          string    (empty string when M not selected),
   *   duration:          string,
   *   concentration:     boolean,
   *   ritual:            boolean,
   *   desc:              string[]  (one element per paragraph),
   *   classes:           string[],
   *   source:            string    (primary source ID, e.g. 'hcs' or 'homebrew'),
   *   page:              string | null,
   *   additionalSources: Array<{ source: string, page: string|null }>,
   * }
   */
  function _getFormData() {
    const name          = els.name.value.trim();
    const level         = parseInt(els.level.value, 10);
    const school        = els.school.value;
    const casting_time  = els.castingTime.value.trim();
    const range         = els.range.value.trim();
    const duration      = els.duration.value.trim();
    const concentration = els.concentration.checked;
    const ritual        = els.ritual.checked;
    const material      = els.material.value.trim();
    const source        = els.source.value;
    const page          = els.page.value.trim() || null;

    const components = [];
    if (els.compV.checked) components.push('V');
    if (els.compS.checked) components.push('S');
    if (els.compM.checked) components.push('M');

    const classes = CLASSES.filter((_, i) => els.classChecks[i].checked);

    const desc = els.desc.value
      .trim()
      .split(/\n{2,}/)
      .map(p => p.trim())
      .filter(Boolean);

    // Additional sources — only present in edit mode; empty array in add mode
    const additionalSources = [];
    root.querySelectorAll('.sf-additional-source-row').forEach(row => {
      const srcVal  = row.querySelector('.sf-additional-source-select')?.value;
      const pageVal = row.querySelector('.sf-additional-source-page')?.value.trim() || null;
      if (srcVal) additionalSources.push({ source: srcVal, page: pageVal });
    });

    // Validation — assertValid throws the first failing message as a plain
    // string; the submit handler displays it directly without .message unwrap.
    assertValid([
      [!!name,                                    'Name is required.'                                              ],
      [!isNaN(level),                             'Level is required.'                                             ],
      [!!school,                                  'School is required.'                                            ],
      [!!casting_time,                            'Casting time is required.'                                      ],
      [!!range,                                   'Range is required.'                                             ],
      [!!duration,                                'Duration is required.'                                          ],
      [desc.length > 0,                           'Description is required.'                                       ],
      [classes.length > 0,                        'At least one class is required.'                                ],
      [!!source,                                  'Source is required.'                                            ],
      [!components.includes('M') || !!material,   'Material component description is required when M is selected.' ],
    ]);

    return {
      name, level, school, casting_time, range, components,
      material, duration, concentration, ritual, desc, classes,
      source, page, additionalSources,
    };
  }

  // ── Edit-mode population ─────────────────────────────────────────────────

  /**
   * Pre-fills every form field from the runtime spell record (initialValues).
   * Called only in edit mode, immediately after _attachListeners.
   * Programmatic .value assignments do not fire 'input', so the
   * beforeunload guard is not armed during this call.
   * Change events are dispatched where listeners must react (M checkbox,
   * source select); 'change' does not trigger the 'input' beforeunload arm.
   */
  function _populateForm() {
    const iv = initialValues;

    // Name — stored lowercase in runtime; convert to title case for display
    els.name.value = toTitleCase(iv.name ?? '');

    // Level
    els.level.value = iv.level ?? 0;

    // School
    els.school.value = iv.school ?? '';

    // Casting time / range / duration
    els.castingTime.value = iv.casting_time ?? '';
    els.range.value       = iv.range        ?? '';
    els.duration.value    = iv.duration     ?? '';

    // Flags
    els.concentration.checked = !!iv.concentration;
    els.ritual.checked        = !!iv.ritual;

    // Components — set checkboxes, then fire change on M to show material field
    els.compV.checked = (iv.components ?? []).includes('V');
    els.compS.checked = (iv.components ?? []).includes('S');
    els.compM.checked = (iv.components ?? []).includes('M');
    els.compM.dispatchEvent(new Event('change'));

    // Material (only populated if M is checked)
    els.material.value = iv.material ?? '';

    // Classes
    CLASSES.forEach((cls, i) => {
      els.classChecks[i].checked = (iv.classes ?? []).includes(cls);
    });

    // Primary source — disable, fire change to handle page field visibility
    els.source.value    = iv.sources?.[0]?.source ?? '';
    els.source.disabled = true;
    els.source.dispatchEvent(new Event('change'));

    // Primary page — stored as number or 'N/A' in runtime; blank if N/A
    const rawPage = iv.sources?.[0]?.page;
    els.page.value = (rawPage == null || rawPage === 'N/A') ? '' : String(rawPage);

    // Description — runtime stores as array; join with blank line for textarea
    els.desc.value = (iv.spell_desc ?? []).join('\n\n');

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
    section.className = 'form-section sf-additional-sources';
    section.innerHTML = `
      <p class="section-label">Additional Sources</p>
      <p class="field-hint">The primary source cannot be changed. Add other books
        or supplements where this spell also appears.</p>
      <div id="sf-additional-sources-rows"></div>
      <button type="button" id="sf-add-additional-source">+ Add Source</button>
    `;
    sourceRow.after(section);

    // Pre-fill from sources[1..]
    for (const src of existingSources.slice(1)) {
      _addAdditionalSourceRow(src);
    }

    section.querySelector('#sf-add-additional-source')
      ?.addEventListener('click', () => _addAdditionalSourceRow(null));
  }

  /**
   * Appends one additional-source row (select + page input + Remove button).
   * Optionally pre-fills from an existing { source, page } object.
   *
   * @param {object|null} existing - { source, page } or null for a blank row.
   */
  function _addAdditionalSourceRow(existing) {
    const rowsEl = root.querySelector('#sf-additional-sources-rows');
    if (!rowsEl) return;

    const row = document.createElement('div');
    row.className = 'sf-additional-source-row form-row';
    row.innerHTML = `
      <div class="form-field">
        <select class="sf-additional-source-select">
          ${buildSortedSourceOptions(sources)}
        </select>
      </div>
      <div class="form-field">
        <input type="text" class="sf-additional-source-page"
               placeholder="Page" autocomplete="off">
      </div>
      <button type="button" class="remove-row-btn">Remove</button>
    `;

    if (existing?.source) {
      row.querySelector('.sf-additional-source-select').value = existing.source;
    }
    const rawPage = existing?.page;
    if (rawPage != null && rawPage !== 'N/A') {
      row.querySelector('.sf-additional-source-page').value = String(rawPage);
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
 * @param {Array}   sources - Source records { id, name } — sorted A–Z in output.
 * @param {boolean} isEdit  - True when mounting in edit mode.
 */
function _buildHTML(sources, isEdit = false) {
  const levelOptions = LEVELS
    .map(l => `<option value="${l.value}">${l.label}</option>`)
    .join('\n            ');

  const schoolOptions = ['<option value="">— select —</option>',
    ...SCHOOLS.map(s => `<option value="${s}">${s}</option>`),
  ].join('\n            ');

  const sourceOptions = buildSortedSourceOptions(sources);

  const classCheckboxes = CLASSES
    .map(c => `<label class="checkbox-label">
              <input type="checkbox" class="sf-class" value="${c}"> ${c}
            </label>`)
    .join('\n            ');

  const submitLabel = isEdit ? 'Save Changes' : 'Save Spell';

  return `<form id="spells-form" novalidate>

      <div class="form-field">
        <label for="sf-name">Name <span class="required">*</span></label>
        <input type="text" id="sf-name" autocomplete="off">
      </div>

      <div class="form-row">
        <div class="form-field">
          <label for="sf-level">Level <span class="required">*</span></label>
          <select id="sf-level">
            ${levelOptions}
          </select>
        </div>
        <div class="form-field">
          <label for="sf-school">School <span class="required">*</span></label>
          <select id="sf-school">
            ${schoolOptions}
          </select>
        </div>
      </div>

      <div class="form-row">
        <div class="form-field">
          <label for="sf-casting-time">Casting Time <span class="required">*</span></label>
          <input type="text" id="sf-casting-time" autocomplete="off"
                 placeholder="e.g. 1 action">
        </div>
        <div class="form-field">
          <label for="sf-range">Range <span class="required">*</span></label>
          <input type="text" id="sf-range" autocomplete="off"
                 placeholder="e.g. 60 feet">
        </div>
      </div>

      <div class="form-field">
        <label for="sf-duration">Duration <span class="required">*</span></label>
        <input type="text" id="sf-duration" autocomplete="off"
               placeholder="e.g. 1 minute, Up to 1 hour">
      </div>

      <div class="form-row">
        <div class="form-field">
          <label>Components</label>
          <div class="checkbox-group inline">
            <label class="checkbox-label">
              <input type="checkbox" id="sf-comp-v"> V
            </label>
            <label class="checkbox-label">
              <input type="checkbox" id="sf-comp-s"> S
            </label>
            <label class="checkbox-label">
              <input type="checkbox" id="sf-comp-m"> M
            </label>
          </div>
        </div>
        <div class="form-field">
          <label>Flags</label>
          <div class="checkbox-group inline">
            <label class="checkbox-label">
              <input type="checkbox" id="sf-concentration"> Concentration
            </label>
            <label class="checkbox-label">
              <input type="checkbox" id="sf-ritual"> Ritual
            </label>
          </div>
        </div>
      </div>

      <div class="form-field" id="sf-material-field" style="display:none">
        <label for="sf-material">Material Component</label>
        <input type="text" id="sf-material" autocomplete="off"
               placeholder="e.g. a pinch of sulfur and a drop of oil">
      </div>

      <div class="form-field">
        <label>Classes <span class="required">*</span></label>
        <div class="checkbox-group grid">
            ${classCheckboxes}
        </div>
      </div>

      <div class="form-row">
        <div class="form-field">
          <label for="sf-source">Source <span class="required">*</span></label>
          <select id="sf-source">
            ${sourceOptions}
          </select>
        </div>
        <div class="form-field" id="sf-page-field">
          <label for="sf-page">Page</label>
          <input type="text" id="sf-page" autocomplete="off"
                 placeholder="e.g. 215">
        </div>
      </div>

      <div class="form-field">
        <label for="sf-desc">Description <span class="required">*</span></label>
        <p class="field-hint">Separate paragraphs with a blank line.</p>
        <textarea id="sf-desc" rows="12"></textarea>
      </div>

      <p id="sf-error" class="form-error" aria-live="polite"></p>
      <button type="button" id="sf-submit" class="btn-primary">${submitLabel}</button>

    </form>`;
}
