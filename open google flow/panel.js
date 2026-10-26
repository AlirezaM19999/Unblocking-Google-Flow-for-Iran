const FLOW_URL = "https://flow.google.com/",
    CONTENT_SCRIPT_ID = "flow-helper",
    UNSUPPORTED_COUNTRY_PATH = "/unsupported-country",
    STATES = {
        enabled: {
            dot: "ok",
            strong: !0,
            text: "Helper is on. Reload your Flow tabs to apply."
        },
        disabled: {
            dot: "idle",
            strong: !1,
            text: "Helper is off. Flow may show the unsupported-country page."
        },
        active: {
            dot: "ok",
            strong: !0,
            text: "Helper is active on this tab — region check patched."
        },
        armed: {
            dot: "armed",
            strong: !1,
            text: "Armed and waiting for Flow’s config response…"
        },
        awaitingSpec: {
            dot: "armed",
            strong: !1,
            text: "Connecting to CFC… almost ready."
        },
        specUnavailable: {
            dot: "warn",
            strong: !0,
            text: "Couldn’t reach CFC. Check your connection and reload."
        },
        schemaMismatch: {
            dot: "bad",
            strong: !0,
            text: "Flow may have changed — the helper needs an update."
        },
        reloadTab: {
            dot: "warn",
            strong: !1,
            text: "Reload this Flow tab to activate the helper."
        },
        saved: {
            dot: "ok",
            strong: !0,
            text: "Saved. Reload any open Flow tabs to apply."
        }
    },
    MSG_PICK_FLOW_TAB = "Switch to a Flow tab first.",
    MSG_SAVE_FAILED = "The setting could not be saved.",
    toggle = document.getElementById("toggle"),
    statusEl = document.getElementById("status"),
    error = document.getElementById("error"),
    reload = document.getElementById("reload");
let tab;

function setStatus(t) {
    const e = STATES[t];
    statusEl.classList.toggle("is-strong", e.strong), statusEl.querySelector(".status-dot").className = "status-dot status-dot--" + e.dot, statusEl.querySelector(".status-text").textContent = e.text
}

function setEnabled(t) {
    toggle.setAttribute("aria-checked", String(t))
}
async function init() {
    const t = (await chrome.scripting.getRegisteredContentScripts({
        ids: ["flow-helper"]
    })).length > 0;
    setEnabled(t), [tab] = await chrome.tabs.query({
        active: !0,
        currentWindow: !0
    });
    const e = tab?.url?.startsWith(FLOW_URL);
    if (reload.hidden = !e, setStatus(t ? "enabled" : "disabled"), e && t) try {
        const t = await chrome.tabs.sendMessage(tab.id, {
            type: "status"
        });
        t.applied ? setStatus("active") : "armed" === t.state ? setStatus("armed") : "awaiting-spec" === t.state ? setStatus("awaitingSpec") : t.state?.startsWith("spec unavailable") || t.state?.startsWith("spec invalid") ? setStatus("specUnavailable") : t.state?.startsWith("schema mismatch") ? setStatus("schemaMismatch") : setStatus("reloadTab")
    } catch {
        setStatus("reloadTab")
    }
    toggle.disabled = !1
}
toggle.addEventListener("click", async () => {
    const t = "true" !== toggle.getAttribute("aria-checked");
    toggle.disabled = !0, error.textContent = "";
    try {
        const e = await chrome.runtime.sendMessage({
            type: "setEnabled",
            enabled: t
        });
        if (!e?.ok) throw new Error(e?.error || MSG_SAVE_FAILED);
        setEnabled(t), setStatus("saved")
    } catch (e) {
        setEnabled(!t), error.textContent = e.message
    } finally {
        toggle.disabled = !1
    }
}), document.getElementById("open").onclick = () => chrome.tabs.create({
    url: FLOW_URL
}), reload.onclick = async () => {
    try {
        const t = await chrome.tabs.get(tab.id);
        if (!t.url?.startsWith(FLOW_URL)) throw new Error(MSG_PICK_FLOW_TAB);
        if (new URL(t.url).pathname.endsWith("/unsupported-country")) {
            const e = new URL(t.url);
            e.pathname = e.pathname.replace(/unsupported-country$/, ""), await chrome.tabs.update(tab.id, {
                url: e.href
            })
        } else await chrome.tabs.reload(tab.id);
        window.close()
    } catch (t) {
        error.textContent = t.message
    }
}, init().catch(t => {
    error.textContent = t.message
});