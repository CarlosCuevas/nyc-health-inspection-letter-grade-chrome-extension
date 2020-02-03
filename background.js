chrome.webNavigation.onHistoryStateUpdated.addListener(details => {
	chrome.tabs.sendMessage(details.tabId, {action: 'url_change'}, response => {
	  	console.assert(response.message === 'ACK');
	});
});
