(() => {
    "use strict";
    let e;
    async function t() {
        if (void 0 !== e) return e;
        try {
            const t = await chrome.runtime.sendMessage({
                type: "getSpec"
            });
            e = t?.ok && t.spec ? t.spec : null
        } catch {
            e = null
        }
        return e
    }

    function n(e) {
        window.postMessage({
            type: "flow-spec-response",
            spec: e
        }, location.origin)
    }
    window.addEventListener("message", e => {
        e.source === window && "flow-spec-request" === e.data?.type && t().then(n)
    }), t().then(n)
})();