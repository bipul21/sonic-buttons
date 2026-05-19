console.log("Running Sonic Buttons Code");

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
    wrapper.className = "d-flex flex-items-center";

    const details = document.createElement("details");
    details.className = "details-reset details-overlay position-relative";

    const summary = document.createElement("summary");
    summary.className = "btn";
    summary.style.minWidth = "100px";
    summary.style.display = "inline-flex";
    summary.style.alignItems = "center";
    summary.style.justifyContent = "space-between";

    const summaryLabel = document.createElement("span");
    summaryLabel.textContent = "Sonic";
    const summaryCaret = document.createElement("span");
    summaryCaret.textContent = "▾";
    summary.appendChild(summaryLabel);
    summary.appendChild(summaryCaret);

    details.appendChild(summary);

    const menu = document.createElement("div");
    menu.className = "SelectMenu position-absolute";
    menu.style.zIndex = "100";
    menu.style.marginTop = "4px";

    const modal = document.createElement("div");
    modal.className = "SelectMenu-modal";
    modal.style.minWidth = "300px";

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

    modal.appendChild(list);
    menu.appendChild(modal);
    details.appendChild(menu);
    wrapper.appendChild(details);

    const submitBtn = document.createElement("button");
    submitBtn.type = "button";
    submitBtn.className = "btn btn-primary ml-1";
    submitBtn.textContent = "Submit";
    submitBtn.addEventListener("click", function () {
        const checked = list.querySelectorAll('input[type="checkbox"]:checked');
        const selected = Array.from(checked).map(c => c.value);
        submitSelectedCodes(selected, submitBtn);
    });
    wrapper.appendChild(submitBtn);

    return wrapper;
}

const parentDiv = document.getElementById("issue-comment-box");

chrome.storage.local.get(['userMessage'], function (result) {
    let commentButtonTexts = ["RUN_SCA", "RUN_UNIT_TESTS"];
    if (result.userMessage) {
        commentButtonTexts = result.userMessage.split(",").map(e => e.trim()).filter(Boolean);
    }

    const sonicContainer = document.createElement("div");
    sonicContainer.className = "d-flex flex-items-center flex-justify-end";
    sonicContainer.style.padding = "8px 0";

    sonicContainer.appendChild(buildCustomDropdown(commentButtonTexts));

    parentDiv.insertBefore(sonicContainer, parentDiv.firstChild);
});
