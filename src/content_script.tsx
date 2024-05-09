console.log("hi");
chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  if (msg.id === "GET_CURRENT_CONTEXT") {
    sendResponse({
      url: window.location.href,
      title: document.title,
      selection: window.getSelection()?.toString() || null,
      pageContent: document.body.innerText,
    });
  }
});
