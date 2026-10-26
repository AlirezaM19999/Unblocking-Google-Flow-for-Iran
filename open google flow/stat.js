const DIAGNOSTIC_ATTRIBUTE = "data-flow-local-diagnostic",
    MAX_STATE_LENGTH = 80;
chrome.runtime.onMessage.addListener((t, e, a) => {
    if (e.id !== chrome.runtime.id || "status" !== t?.type) return;
    let i;
    try {
        i = JSON.parse(document.documentElement.getAttribute(DIAGNOSTIC_ATTRIBUTE) || "null")
    } catch {}
    a({
        state: "string" == typeof i?.state ? i.state.slice(0, 80) : "not-loaded",
        applied: i?.applied > 0
    })
});