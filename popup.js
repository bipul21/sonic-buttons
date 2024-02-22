document.addEventListener('DOMContentLoaded', function () {
    var sendMessageBtn = document.getElementById('sendMessageBtn');
    var userMessageInput = document.getElementById('userMessageInput');

    // Fetch the current value of userMessage from storage
    chrome.storage.local.get(['userMessage'], function (result) {
        if (result.userMessage) {
            userMessageInput.value = result.userMessage;
        }
    });

    sendMessageBtn.addEventListener('click', function () {
        var message = userMessageInput.value;
        chrome.storage.local.set({ 'userMessage': message }, function () {
        console.log('User message sent to storage: ' + message);
        });
    });
});