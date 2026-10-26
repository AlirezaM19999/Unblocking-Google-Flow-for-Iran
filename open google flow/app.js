const SPEC_URL = "https://flow-spec-api.bg-alborz.workers.dev/",
    SPEC_TTL_MS = 216e5,
    registration = {
        id: "flow-helper",
        matches: ["https://flow.google.com/*"],
        js: ["engine.js"],
        runAt: "document_start",
        world: "MAIN",
        persistAcrossSessions: !0
    },
    REGISTRATIONS = [registration],
    REGISTRATION_IDS = REGISTRATIONS.map(e => e.id);
let specCache = null,
    specFetchedAt = 0,
    specInFlight = null;
async function fetchSpec() {
    const e = Date.now();
    return specCache && e - specFetchedAt < 216e5 ? specCache : specInFlight || (specInFlight = (async () => {
        try {
            const e = await fetch(SPEC_URL, {
                cache: "no-store"
            });
            if (!e.ok) throw new Error("HTTP " + e.status);
            const t = await e.json();
            return specCache = t, specFetchedAt = Date.now(), t
        } catch (e) {
            return console.warn("Flow spec fetch failed:", e.message), specCache
        } finally {
            specInFlight = null
        }
    })(), specInFlight)
}
chrome.runtime.onInstalled.addListener(async ({
    reason: e
}) => {
    if ("install" === e) try {
        await chrome.scripting.registerContentScripts(REGISTRATIONS)
    } catch (e) {
        console.error("Flow setup failed:", e.message)
    }
}), chrome.runtime.onMessage.addListener((e, t, s) => {
    if (t.id === chrome.runtime.id) return "getSpec" === e?.type ? ((async () => {
        const e = await fetchSpec();
        s({
            ok: !!e,
            spec: e
        })
    })(), !0) : t.tab || "setEnabled" !== e?.type ? void 0 : ((async () => {
        const t = await chrome.scripting.getRegisteredContentScripts({
            ids: REGISTRATION_IDS
        });
        e.enabled && 0 === t.length ? await chrome.scripting.registerContentScripts(REGISTRATIONS) : !e.enabled && t.length > 0 && await chrome.scripting.unregisterContentScripts({
            ids: REGISTRATION_IDS
        }), s({
            ok: !0
        })
    })().catch(e => s({
        ok: !1,
        error: e.message
    })), !0)
});