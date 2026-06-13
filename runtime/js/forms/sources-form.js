/* ---------------------------------------------------------
   Path:         runtime/js/forms/sources-form.js
   File:         sources-form.js
   Version:      V1.1
   Data Schema:  n/a
   System:       RSR
   Module/Role:  Form — renders the add-source HTML form and calls onSubmit
                 with validated values on save
   Dependencies: none
   Created:      2026-05-02
   Last Updated: 2026-05-08
--------------------------------------------------------- */
/* Changelog:
   V1.1:
   - Converted SourcesForm class to mountSourcesForm function, matching the
     mount/teardown pattern used by all other forms. Public API is now
     mountSourcesForm(container, onSubmit) → teardown.
   - Added beforeunload guard: set on first input event, cleared on teardown
     and on successful submit.
   V1.0:
   - Initial creation. SourcesForm class with render(), getValues(),
     and validate().
*/

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Renders the add-source form into `container`, replacing any existing content.
 * All state is held in closure — multiple independent mounts do not share state.
 *
 * The form renders a submit button. When clicked it validates the current
 * values, displays any validation error inline, and on success calls
 * onSubmit(values). If onSubmit throws (e.g. a writer error), the error
 * message is displayed and the button is re-enabled.
 *
 * onSubmit receives a FormValues object:
 *   {
 *     idKey:        string    — ID key without the SRC_ prefix, uppercased
 *                              e.g. "PHB14"  (writer derives "SRC_PHB14" and "phb14")
 *     name:         string
 *     abbreviation: string
 *     publisher:    string
 *     year:         number
 *     aliases?:     string[]  — present only when the user entered at least one alias
 *   }
 *
 * @param {HTMLElement} container
 * @param {Function}    [onSubmit] - Async callback receiving the validated
 *                        form values object. May be omitted in test contexts.
 * @returns {Function} teardown — clears the beforeunload guard and empties
 *                        the container. Call when unmounting the form.
 */
export function mountSourcesForm(container, onSubmit) {
  // ── Closure state ────────────────────────────────────────────────────────
  let root = container;
  root.innerHTML = _buildHTML();

  // ── beforeunload guard ───────────────────────────────────────────────────
  function _handleBeforeUnload(e) {
    e.preventDefault();
    e.returnValue = '';
  }

  function _armBeforeUnload() {
    window.addEventListener('beforeunload', _handleBeforeUnload);
  }

  function _disarmBeforeUnload() {
    window.removeEventListener('beforeunload', _handleBeforeUnload);
  }

  // Arm on first input — { once: true } so the listener fires at most once
  root.addEventListener('input', _armBeforeUnload, { once: true });

  // ── Element helpers ──────────────────────────────────────────────────────
  const q = id => root.querySelector(`#${id}`);

  const submitBtn = q('src-submit');
  const errorEl   = q('src-error');

  // ── Form data reader ─────────────────────────────────────────────────────

  function _getValues() {
    const idKey        = q('src-id').value.trim().toUpperCase();
    const name         = q('src-name').value.trim();
    const abbreviation = q('src-abbreviation').value.trim();
    const publisher    = q('src-publisher').value.trim();
    const year         = parseInt(q('src-year').value, 10);
    const aliasRaw     = q('src-aliases').value.trim();

    const result = { idKey, name, abbreviation, publisher, year };

    if (aliasRaw) {
      result.aliases = aliasRaw.split(',').map(a => a.trim()).filter(Boolean);
    }

    return result;
  }

  function _validate(v) {
    return (
      v.idKey.length > 0 &&
      v.name.length > 0 &&
      v.abbreviation.length > 0 &&
      v.publisher.length > 0 &&
      !isNaN(v.year)
    );
  }

  // ── Submit handler ───────────────────────────────────────────────────────
  submitBtn.addEventListener('click', async () => {
    errorEl.textContent = '';
    const values = _getValues();
    if (!_validate(values)) {
      errorEl.textContent = 'All fields except Aliases are required, and Year must be a number.';
      return;
    }
    submitBtn.disabled = true;
    try {
      await onSubmit?.(values);
      _disarmBeforeUnload();
    } catch (err) {
      errorEl.textContent = err.message ?? String(err);
    } finally {
      submitBtn.disabled = false;
    }
  });

  // ── Teardown ─────────────────────────────────────────────────────────────

  function teardown() {
    _disarmBeforeUnload();
    if (root) {
      root.innerHTML = '';
      root = null;
    }
  }

  return teardown;
}

// ── Internal: HTML builder ─────────────────────────────────────────────────

function _buildHTML() {
  return `
<div class="sources-form">

  <div class="form-field">
    <label for="src-id">ID key <span class="required">*</span></label>
    <span class="form-hint">
      Enter without the <code>SRC_</code> prefix — e.g. <code>PHB14</code>.
      Uppercase is applied automatically.
    </span>
    <input type="text" id="src-id" name="id"
           autocomplete="off" placeholder="PHB14" required />
  </div>

  <div class="form-field">
    <label for="src-name">Name <span class="required">*</span></label>
    <input type="text" id="src-name" name="name"
           autocomplete="off" placeholder="Player's Handbook 2014" required />
  </div>

  <div class="form-field">
    <label for="src-abbreviation">Abbreviation <span class="required">*</span></label>
    <input type="text" id="src-abbreviation" name="abbreviation"
           autocomplete="off" placeholder="PHB2014" required />
  </div>

  <div class="form-field">
    <label for="src-publisher">Publisher <span class="required">*</span></label>
    <input type="text" id="src-publisher" name="publisher"
           autocomplete="off" placeholder="Wizards of the Coast" required />
  </div>

  <div class="form-field">
    <label for="src-year">Year <span class="required">*</span></label>
    <input type="number" id="src-year" name="year"
           min="1974" max="2099" placeholder="2024" required />
  </div>

  <div class="form-field">
    <label for="src-aliases">
      Aliases <span class="form-optional">(optional)</span>
    </label>
    <span class="form-hint">Comma-separated alternate names for this source.</span>
    <input type="text" id="src-aliases" name="aliases"
           autocomplete="off" placeholder="Dungeon Master's Guide, DMG" />
  </div>

  <p id="src-error" class="form-error" aria-live="polite"></p>
  <button type="button" id="src-submit" class="btn-primary">Save</button>

</div>`;
}
