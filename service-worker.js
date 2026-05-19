import Analytics from './scripts/google-analytics.js';

addEventListener('unhandledrejection', async (event) => {
  Analytics.fireErrorEvent(event.reason);
});

chrome.runtime.onInstalled.addListener(() => {
   chrome.storage.local.get(['userMessage'], function (result) {
        if (!result.userMessage) {
          chrome.storage.local.set({ 'userMessage': 'RUN_SCA,RUN_SYNTAX_CHECK'});
        }
        Analytics.fireEvent('install_extension');
    });
});

//async function throwAnException() {
//  throw new Error("I'm an error");
//}

//Listen for when a Tab changes state
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab){
    if(changeInfo && changeInfo.status == "complete"){
        if(tab.url){
            let regex1 = /https:\/\/github\.com\/[A-Za-z0-9\-]+\/[A-Za-z0-9\-]+\/pull\/[0-9]+$/i;
//            console.log("Coming here ", tab.url, regex1.test(tab.url))
            if(regex1.test(tab.url)){
                chrome.tabs.sendMessage(tabId, {"reloadSonicButton": "reloadSonicButton"});
            }
        }
    }
});


// Throw an exception after a timeout to trigger an exception analytics event
//setTimeout(throwAnException, 2000);


// GA4 event params must be primitives (string/number/bool); arrays/objects
// are silently dropped, so callers should pre-join lists into strings.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message) return;
  if (message.sonicEvent && typeof message.sonicEvent === 'string') {
    Analytics.fireEvent(message.sonicEvent, message.params || {});
    return;
  }
  // Legacy shapes — kept so older content-script builds still report.
  if (message.sonicButtonClick) {
    Analytics.fireEvent('sonicButtonClick', { name: message.sonicButtonClick });
  } else if (message.sonicButtonShown) {
    Analytics.fireEvent('sonicButtonShown');
  }
});
