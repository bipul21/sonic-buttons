


document.addEventListener('DOMContentLoaded', function () {
    var sendMessageBtn = document.getElementById('sendMessageBtn');
    var userMessageInput = document.getElementById('userMessageInput');
    var existingCodeDiv = document.getElementById('existing_codes');

    function removeElementClick(event){
        const commandText = event.target.parentElement.textContent.slice(0,-2);
        event.target.parentElement.remove();
        console.log("Removing Element ", commandText);
        chrome.storage.local.get(['userMessage'], function (result) {
            if (result.userMessage) {
                console.log("COming inside user Message");
                commentButtonTexts = result.userMessage.split(",").map(e => e.trim());
                filterCommandText = commentButtonTexts.filter(function(item) {
                        console.log(item, commandText, item !== commandText );
                        return item !== commandText;
                    });
                console.log(commentButtonTexts);

                chrome.storage.local.set({ 'userMessage': filterCommandText.join(",")});
            }
        });
    }

    function addCommandToExistingDiv(message){
        const newLiTag = document.createElement("li");
        const aLink = document.createElement("a");
        aLink.textContent = " x";
        aLink.href        = "#";
        aLink.commandText = message;
        aLink.style="color: black; text-decoration:none;"
        aLink.addEventListener("click", removeElementClick);
        newLiTag.textContent = message;
        newLiTag.appendChild(aLink);
        existingCodeDiv.appendChild(newLiTag);
    }

    // Fetch the current value of userMessage from storage
    chrome.storage.local.get(['userMessage'], function (result) {
        if (result.userMessage) {
            commentButtonTexts = result.userMessage.split(",").map(e => e.trim());

            for(i=0; i< commentButtonTexts.length; i++){
                const commentButtonText = commentButtonTexts[i]
                addCommandToExistingDiv(commentButtonText);
            }
        }
    });

    sendMessageBtn.addEventListener('click', function () {
        var message = userMessageInput.value;


        chrome.storage.local.get(['userMessage'], function (result) {
            if (result.userMessage) {
                commentButtonTexts = result.userMessage.split(",").map(e => e.trim());
                commentButtonTexts.push(message)
                chrome.storage.local.set({ 'userMessage': commentButtonTexts.join(",") }, function () {
                    console.log('User message sent to storage: ' + message);
                });
                addCommandToExistingDiv(message);
            }else{
                addCommandToExistingDiv(message);
                chrome.storage.local.set({ 'userMessage': message }, function () {
                    console.log('User message sent to storage: ' + message);
                });
            }
        });
        userMessageInput.value="";
        userMessageInput.focus();
    });
});