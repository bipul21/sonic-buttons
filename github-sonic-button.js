console.log("Running Sonic Buttons Code");

function sonicButtonClick(event) {
    const commentString = event.target.textContent;
    document.getElementById('partial-new-comment-form-actions')
    document.getElementById('new_comment_field').value = commentString;
    document.getElementById("new_comment_form").submit();
    document.getElementById('new_comment_field').value = "";
}

const parentDiv = document.getElementById("issue-comment-box");
//const targetDiv = parentDiv.querySelector(".d-flex.flex-justify-end");

chrome.storage.local.get(['userMessage'], function (result) {
    let commentButtonTexts = ["RUN_SCA", "RUN_UNIT_TESTS"];
    if (result.userMessage) {
        commentButtonTexts = result.userMessage.split(",").map(e => e.trim());
    }
    const sonicButtonDiv = document.createElement("div");
    sonicButtonDiv.className = "d-flex ml-2 pl-7"; // Set class attribute

    for (let i = 0; i < commentButtonTexts.length; i++) {
        const commentButtonText = commentButtonTexts[i]
        const newDiv = document.createElement("div");
        newDiv.className = "mr-1"; // Set class attribute
        const newButton = document.createElement("button");
        newButton.id = "sonic_sca_click";
        newButton.type ="button";
        newButton.className = "btn"; // Set class attribute
        newButton.textContent = commentButtonText;
        newButton.addEventListener("click", sonicButtonClick);
        newDiv.appendChild(newButton);
        sonicButtonDiv.appendChild(newDiv)
    }
    parentDiv.insertBefore(sonicButtonDiv, parentDiv.firstChild);
});
