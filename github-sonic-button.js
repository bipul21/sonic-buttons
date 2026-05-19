console.log("Running Sonic Buttons Code");

const DETECTION_WAIT_MS = 6000;
const CONTAINER_ID = "sonic-buttons-container";
const STYLE_ID = "sonic-buttons-styles";
const TOAST_AUTODISMISS_MS = 4000;

let EXT_VERSION = "unknown";
try { EXT_VERSION = chrome.runtime.getManifest().version || "unknown"; } catch (_) {}

// Best-effort analytics. The page can outlive the extension context
// (e.g. user reloads the extension), so swallow send errors.
function track(eventName, params) {
    try {
        chrome.runtime.sendMessage({
            sonicEvent: eventName,
            params: Object.assign({ ext_version: EXT_VERSION }, params || {}),
        });
    } catch (_) {}
}

function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
.sonic-chip { position: relative; }
.sonic-chip.is-selected {
    background-color: var(--color-accent-emphasis, #0969da) !important;
    color: var(--color-fg-on-emphasis, #ffffff) !important;
    border-color: var(--color-accent-emphasis, #0969da) !important;
}
.sonic-chip.is-error {
    background-color: var(--color-danger-subtle, #ffebe9) !important;
    border-color: var(--color-danger-emphasis, #cf222e) !important;
    color: var(--color-danger-fg, #cf222e) !important;
}
.sonic-chip.is-error::after {
    content: "!";
    position: absolute;
    top: -6px;
    right: -6px;
    background: var(--color-danger-emphasis, #cf222e);
    color: #fff;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    font-size: 10px;
    line-height: 14px;
    text-align: center;
    font-weight: bold;
}
.sonic-toast {
    padding: 6px 10px;
    border-radius: 6px;
    font-size: 12px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    align-self: flex-start;
}
.sonic-toast.is-success { background: var(--color-success-subtle, #dafbe1); color: var(--color-success-fg, #1a7f37); }
.sonic-toast.is-partial { background: var(--color-attention-subtle, #fff8c5); color: var(--color-attention-fg, #9a6700); }
.sonic-toast.is-error   { background: var(--color-danger-subtle, #ffebe9); color: var(--color-danger-fg, #cf222e); }
`;
    document.head.appendChild(style);
}

function detectCodesFromChecks() {
    const scopes = new Set();
    [
        '.merge-status-list',
        '.merge-status-item',
        '.branch-action-item',
        '[class*="MergeBox"]',
    ].forEach(sel => {
        document.querySelectorAll(sel).forEach(n => scopes.add(n));
    });
    const seen = new Set();
    for (const node of scopes) {
        const matches = (node.textContent || '').match(/\bRUN_[A-Z][A-Z0-9_]*\b/g) || [];
        matches.forEach(m => seen.add(m));
    }
    return Array.from(seen);
}

function waitForElement(selector, timeoutMs) {
    return new Promise(resolve => {
        const existing = document.querySelector(selector);
        if (existing) return resolve(existing);
        const obs = new MutationObserver(() => {
            const el = document.querySelector(selector);
            if (el) { obs.disconnect(); resolve(el); }
        });
        obs.observe(document.body, { childList: true, subtree: true });
        setTimeout(() => { obs.disconnect(); resolve(null); }, timeoutMs);
    });
}

async function refreshAuthenticityToken(form, response) {
    try {
        const html = await response.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const refreshedForm = doc.getElementById('new_comment_form');
        const refreshedTokenInput = refreshedForm
            ? refreshedForm.querySelector('input[name="authenticity_token"]')
            : null;
        const currentTokenInput = form.querySelector('input[name="authenticity_token"]');
        if (refreshedTokenInput && currentTokenInput) {
            currentTokenInput.value = refreshedTokenInput.value;
            return true;
        }
        return false;
    } catch (err) {
        console.error("Sonic Buttons: failed to refresh token", err);
        return false;
    }
}

async function submitOneCode(code, form, field) {
    field.value = code;
    const formData = new FormData(form);
    let response;
    try {
        response = await fetch(form.action, {
            method: form.method || 'POST',
            body: formData,
            credentials: 'same-origin',
            redirect: 'follow',
            headers: { 'Accept': 'text/html, application/xhtml+xml' },
        });
    } catch (err) {
        return { ok: false, stage: 'network', status: 0, response: null };
    }
    if (!response.ok) {
        return { ok: false, stage: 'http', status: response.status, response };
    }
    return { ok: true, stage: 'ok', status: response.status, response };
}

function showToast(container, text, variant) {
    const existing = container.querySelector('.sonic-toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = `sonic-toast is-${variant}`;
    toast.textContent = text;
    container.appendChild(toast);
    setTimeout(() => { if (toast.parentNode) toast.remove(); }, TOAST_AUTODISMISS_MS);
}

function buildSelectableRow(codes, sonicContainer) {
    const total = codes.length;

    const wrapper = document.createElement("div");
    wrapper.className = "d-flex flex-items-start flex-justify-between";
    wrapper.style.gap = "12px";
    wrapper.style.width = "100%";

    const chipsRow = document.createElement("div");
    chipsRow.className = "d-flex flex-wrap flex-items-center";
    chipsRow.style.gap = "6px";
    chipsRow.style.flex = "1 1 auto";
    chipsRow.style.minWidth = "0";

    const submitBtn = document.createElement("button");
    submitBtn.type = "button";
    submitBtn.className = "btn btn-primary";
    submitBtn.style.flex = "0 0 auto";
    submitBtn.style.alignSelf = "flex-start";

    const state = new Map();
    codes.forEach(c => state.set(c, false));
    const chipByCode = new Map();
    const checkboxByCode = new Map();
    const errored = new Set();
    let submitting = false;
    let selectAllBtn = null;

    function refreshChip(code) {
        const el = chipByCode.get(code);
        if (!el) return;
        el.classList.toggle('is-selected', !!state.get(code));
        el.classList.toggle('is-error', errored.has(code));
    }

    function refresh() {
        const n = codes.filter(c => state.get(c)).length;
        submitBtn.textContent = n > 0 ? `Submit ${n}/${total}` : "Submit";
        submitBtn.disabled = submitting || n === 0;
        if (selectAllBtn) {
            selectAllBtn.textContent = codes.every(c => state.get(c)) ? "Clear all" : "Select all";
        }
    }

    function setChipChecked(code, checked) {
        state.set(code, checked);
        if (checked) errored.delete(code);
        const cb = checkboxByCode.get(code);
        if (cb && cb.checked !== checked) cb.checked = checked;
        refreshChip(code);
    }

    function lockRow(locked) {
        submitting = locked;
        checkboxByCode.forEach(cb => { cb.disabled = locked; });
        if (selectAllBtn) selectAllBtn.disabled = locked;
        refresh();
    }

    function makeChip(code) {
        const label = document.createElement("label");
        label.className = "btn d-inline-flex flex-items-center sonic-chip";
        label.style.cursor = "pointer";
        label.style.gap = "6px";
        label.style.userSelect = "none";
        label.style.fontWeight = "normal";

        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.value = code;
        cb.style.margin = "0";
        cb.addEventListener("change", () => {
            setChipChecked(code, cb.checked);
            track('sonic_chip_toggled', { code, checked: cb.checked });
            refresh();
        });
        label.appendChild(cb);
        label.appendChild(document.createTextNode(code));
        chipByCode.set(code, label);
        checkboxByCode.set(code, cb);
        return label;
    }

    if (codes.length >= 3) {
        selectAllBtn = document.createElement("button");
        selectAllBtn.type = "button";
        selectAllBtn.className = "btn-link f6";
        selectAllBtn.style.padding = "0 4px";
        selectAllBtn.style.cursor = "pointer";
        selectAllBtn.textContent = "Select all";
        selectAllBtn.addEventListener("click", () => {
            const allSelected = codes.every(c => state.get(c));
            const next = !allSelected;
            codes.forEach(c => setChipChecked(c, next));
            track('sonic_select_all_toggled', { selected: next, total: codes.length });
            refresh();
        });
        chipsRow.appendChild(selectAllBtn);
    }

    for (const code of codes) {
        chipsRow.appendChild(makeChip(code));
    }

    submitBtn.addEventListener("click", async () => {
        if (submitting) return;
        const selected = codes.filter(c => state.get(c));
        if (selected.length === 0) return;

        const startedAt = Date.now();
        track('sonic_submit_started', {
            selected_count: selected.length,
            total_count: total,
            codes: selected.join(','),
        });

        const field = document.getElementById('new_comment_field');
        const form  = document.getElementById('new_comment_form');
        if (!field || !form) {
            console.error("Sonic Buttons: comment form not found on page");
            track('sonic_submit_error', { stage: 'no_form', codes: selected.join(',') });
            showToast(sonicContainer, "Couldn't find GitHub's comment form. Refresh and retry.", 'error');
            return;
        }

        lockRow(true);
        const originalText = submitBtn.textContent;
        submitBtn.textContent = `Submitting 0/${selected.length}…`;
        selected.forEach(c => { errored.delete(c); refreshChip(c); });

        const succeededCodes = [];
        const failedCodes = [];
        for (let i = 0; i < selected.length; i++) {
            const code = selected[i];
            const result = await submitOneCode(code, form, field);
            if (!result.ok) {
                console.error("Sonic Buttons: submit failed", code, result);
                failedCodes.push(code);
                track('sonic_submit_error', {
                    stage: result.stage,
                    code,
                    status: result.status,
                });
                break;
            }
            succeededCodes.push(code);
            submitBtn.textContent = `Submitting ${succeededCodes.length}/${selected.length}…`;
            if (i < selected.length - 1) {
                await refreshAuthenticityToken(form, result.response);
            }
        }

        field.value = "";
        succeededCodes.forEach(c => setChipChecked(c, false));
        failedCodes.forEach(c => { errored.add(c); refreshChip(c); });
        submitBtn.textContent = originalText;
        lockRow(false);

        const durationMs = Date.now() - startedAt;
        track('sonic_submit_finished', {
            succeeded: succeededCodes.length,
            failed: failedCodes.length,
            total_attempted: selected.length,
            duration_ms: durationMs,
        });

        if (failedCodes.length === 0) {
            const noun = succeededCodes.length === 1 ? 'check' : 'checks';
            showToast(sonicContainer, `Triggered ${succeededCodes.length} ${noun}.`, 'success');
        } else if (succeededCodes.length === 0) {
            const detail = failedCodes.length <= 3 ? `: ${failedCodes.join(', ')}` : ` (${failedCodes.length})`;
            showToast(sonicContainer, `Failed to trigger${detail}. Retry?`, 'error');
        } else {
            showToast(sonicContainer,
                `Triggered ${succeededCodes.length}/${selected.length}. ${failedCodes.length} failed — retry?`,
                'partial');
        }
    });

    wrapper.appendChild(chipsRow);
    wrapper.appendChild(submitBtn);
    refresh();
    return wrapper;
}

function buildEmptyState() {
    const el = document.createElement("div");
    el.className = "color-fg-muted f6";
    el.textContent = "Sonic Buttons: no RUN_* codes detected on this PR. Configure defaults from the extension popup.";
    return el;
}

function buildBranding() {
    const branding = document.createElement("div");
    branding.className = "d-flex flex-items-center color-fg-muted";
    branding.style.gap = "6px";
    branding.style.fontSize = "12px";

    const brandingIcon = document.createElement("img");
    brandingIcon.src = chrome.runtime.getURL("assets/icon-16.png");
    brandingIcon.alt = "";
    brandingIcon.style.width = "16px";
    brandingIcon.style.height = "16px";

    const brandingText = document.createElement("span");
    brandingText.textContent = "Sonic Buttons";

    branding.appendChild(brandingIcon);
    branding.appendChild(brandingText);
    return branding;
}

function renderSonicContainer(parentDiv, codes) {
    const existing = document.getElementById(CONTAINER_ID);
    if (existing) existing.remove();

    const sonicContainer = document.createElement("div");
    sonicContainer.id = CONTAINER_ID;
    sonicContainer.className = "d-flex flex-column ml-6 pl-7";
    sonicContainer.style.paddingTop = "8px";
    sonicContainer.style.paddingBottom = "8px";
    sonicContainer.style.gap = "8px";

    if (codes.length > 0) {
        sonicContainer.appendChild(buildSelectableRow(codes, sonicContainer));
    } else {
        sonicContainer.appendChild(buildEmptyState());
    }
    sonicContainer.appendChild(buildBranding());

    parentDiv.insertBefore(sonicContainer, parentDiv.firstChild);
    return sonicContainer;
}

(async function init() {
    injectStyles();
    const parentDiv = await waitForElement("#issue-comment-box", 30000);
    if (!parentDiv) return;

    const stored = await new Promise(r => {
        chrome.storage.local.get(['userMessage'], result => {
            const codes = (result && result.userMessage)
                ? result.userMessage.split(",").map(e => e.trim()).filter(Boolean)
                : [];
            r(codes);
        });
    });

    let detected = detectCodesFromChecks();
    let codes = detected.length > 0 ? detected : stored;
    let source = detected.length > 0 ? 'detection' : (stored.length > 0 ? 'fallback' : 'none');
    renderSonicContainer(parentDiv, codes);

    track('sonic_codes_detected', {
        count: codes.length,
        source,
        codes: codes.join(','),
    });

    if (detected.length === 0) {
        const start = Date.now();
        const obs = new MutationObserver(() => {
            if (Date.now() - start > DETECTION_WAIT_MS) {
                obs.disconnect();
                return;
            }
            const found = detectCodesFromChecks();
            if (found.length === 0) return;
            if (found.join("|") === codes.join("|")) {
                obs.disconnect();
                return;
            }
            const container = document.getElementById(CONTAINER_ID);
            const anyChecked = container && container.querySelector('input[type=checkbox]:checked');
            if (!anyChecked) {
                codes = found;
                renderSonicContainer(parentDiv, codes);
                track('sonic_codes_updated', { count: codes.length, codes: codes.join(',') });
            }
            obs.disconnect();
        });
        obs.observe(document.body, { childList: true, subtree: true });
        setTimeout(() => obs.disconnect(), DETECTION_WAIT_MS);
    }
})();
