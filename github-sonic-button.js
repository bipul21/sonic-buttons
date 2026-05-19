console.log("Running Sonic Buttons Code");

const PRESETS = [
    { label: "RUN_FRONTEND_CHECKS",   codes: ["RUN_COVERAGE_CHECK", "RUN_FRONTEND_VALIDATION", "RUN_SCA"] },
    { label: "RUN_TESTSTACK_CHECKS",  codes: ["RUN_SCA", "RUN_SYNTAX_CHECK", "RUN_UNIT_TEST", "RUN_OPENAPI_CHECK"] },
    { label: "RUN_TESTHUB_CHECKS",    codes: ["RUN_SCA", "RUN_CHECKS", "RUN_UNIT_TESTS", "RUN_API_TESTS"] },
    { label: "RUN_SDK_CHECKS",        codes: ["RUN_SCA"] },
    { label: "RUN_AUTOMATION_CHECKS", codes: ["RUN_QUALITY_CHECKS"] },
];

async function submitSelectedCodes(codes, submitBtn) {
    if (!codes || codes.length === 0) return;
    const field = document.getElementById('new_comment_field');
    const form  = document.getElementById('new_comment_form');
    if (!field || !form) {
        console.error("Sonic Buttons: comment form not found on page");
        return;
    }

    const originalText = submitBtn ? submitBtn.textContent : null;
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = `Submitting 0/${codes.length}…`;
    }

    let succeeded = 0;
    for (let i = 0; i < codes.length; i++) {
        const code = codes[i];
        field.value = code;
        const formData = new FormData(form);

        let response;
        try {
            response = await fetch(form.action, {
                method: form.method || 'POST',
                body: formData,
                credentials: 'same-origin',
                redirect: 'follow',
                headers: { 'Accept': 'text/html, application/xhtml+xml' }
            });
        } catch (err) {
            console.error("Sonic Buttons: network error submitting", code, err);
            break;
        }

        if (!response.ok) {
            console.error("Sonic Buttons: server rejected", code, response.status);
            break;
        }
        succeeded++;
        if (submitBtn) submitBtn.textContent = `Submitting ${succeeded}/${codes.length}…`;

        if (i < codes.length - 1) {
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
                } else {
                    console.warn("Sonic Buttons: could not refresh authenticity_token; remaining submissions may fail");
                }
            } catch (err) {
                console.error("Sonic Buttons: failed to refresh token", err);
                break;
            }
        }
    }

    field.value = "";
    if (submitBtn && originalText !== null) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
    if (succeeded > 0) location.reload();
}

function buildCustomDropdown(codes) {
    const wrapper = document.createElement("div");
    wrapper.className = "d-flex flex-column flex-items-center";
    wrapper.style.paddingTop = "6px";
    wrapper.style.gap = "4px";

    const topRow = document.createElement("div");
    topRow.className = "d-flex flex-items-center";

    const details = document.createElement("details");
    details.className = "details-reset details-overlay position-relative";

    const summary = document.createElement("summary");
    summary.className = "btn";
    summary.style.minWidth = "100px";
    summary.style.display = "inline-flex";
    summary.style.alignItems = "center";
    summary.style.justifyContent = "space-between";

    const summaryLabel = document.createElement("span");
    summaryLabel.textContent = "Custom";
    const summaryCaret = document.createElement("span");
    summaryCaret.textContent = "▾";
    summary.appendChild(summaryLabel);
    summary.appendChild(summaryCaret);

    details.appendChild(summary);

    function updateSelectedCount() {
        const count = list.querySelectorAll('input[type="checkbox"]:checked').length;
        summaryLabel.textContent = count > 0 ? `Custom (${count})` : "Custom";
    }

    const menu = document.createElement("div");
    menu.className = "SelectMenu position-absolute";
    menu.style.zIndex = "100";

    const modal = document.createElement("div");
    modal.className = "SelectMenu-modal";
    modal.style.minWidth = "300px";
    modal.style.marginTop = "0.25rem";

    const list = document.createElement("div");
    list.className = "SelectMenu-list";
    list.style.maxHeight = "300px";
    list.style.overflowY = "auto";
    list.style.padding = "4px 0";

    for (const code of codes) {
        const label = document.createElement("label");
        label.className = "SelectMenu-item";
        label.style.cursor = "pointer";
        label.style.display = "flex";
        label.style.alignItems = "center";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.value = code;
        checkbox.className = "mr-2";

        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(code));
        list.appendChild(label);
    }

    list.addEventListener("change", updateSelectedCount);

    modal.appendChild(list);
    menu.appendChild(modal);
    details.appendChild(menu);
    topRow.appendChild(details);

    const submitBtn = document.createElement("button");
    submitBtn.type = "button";
    submitBtn.className = "btn btn-primary ml-1";
    submitBtn.textContent = "Submit";
    submitBtn.addEventListener("click", function () {
        const checked = list.querySelectorAll('input[type="checkbox"]:checked');
        const selected = Array.from(checked).map(c => c.value);
        submitSelectedCodes(selected, submitBtn);
    });
    topRow.appendChild(submitBtn);

    wrapper.appendChild(topRow);

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
    wrapper.appendChild(branding);

    return wrapper;
}

function buildPresets() {
    const wrapper = document.createElement("div");
    wrapper.className = "d-flex flex-wrap flex-items-center";
    wrapper.style.gap = "4px";

    for (const preset of PRESETS) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn";
        btn.textContent = preset.label;
        btn.addEventListener("click", function () {
            submitSelectedCodes(preset.codes, btn);
        });
        wrapper.appendChild(btn);
    }

    return wrapper;
}

const parentDiv = document.getElementById("issue-comment-box");

chrome.storage.local.get(['userMessage'], function (result) {
    let commentButtonTexts = ["RUN_SCA", "RUN_UNIT_TESTS"];
    if (result.userMessage) {
        commentButtonTexts = result.userMessage.split(",").map(e => e.trim()).filter(Boolean);
    }

    const sonicContainer = document.createElement("div");
    sonicContainer.className = "d-flex flex-items-start flex-justify-between ml-6 pl-7";
    sonicContainer.style.paddingTop = "8px";
    sonicContainer.style.paddingBottom = "8px";
    sonicContainer.style.gap = "8px";

    const separator = document.createElement("div");
    separator.style.width = "1px";
    separator.style.alignSelf = "stretch";
    separator.style.backgroundColor = "var(--color-border-default, #d0d7de)";

    const presetCodes = PRESETS.flatMap(p => p.codes);
    const dropdownCodes = [...new Set([...commentButtonTexts, ...presetCodes])];

    sonicContainer.appendChild(buildPresets());
    sonicContainer.appendChild(separator);
    sonicContainer.appendChild(buildCustomDropdown(dropdownCodes));

    parentDiv.insertBefore(sonicContainer, parentDiv.firstChild);
});
