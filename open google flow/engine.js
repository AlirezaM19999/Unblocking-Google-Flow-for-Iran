(function () {
  "use strict";

  var w = window;
  if (w.__rpcLayer) return;
  w.__rpcLayer = true;

  function dec(a) {
    var s = "";
    for (var i = 0; i < a.length; i++) s += String.fromCharCode(a[i]);
    return s;
  }

  var TAG = dec([119, 114, 98, 46, 102, 114]);
  var ID_A = dec([99, 80, 90, 83, 100, 99]);
  var ID_B = dec([75, 86, 50, 84, 50, 100]);
  var ID_C = dec([99, 79, 55, 74, 79, 98]);

  var ATTR = "data-net-state";
  var VER = "nethook/1.0.0";
  var CACHE = "__netHookOut";
  var URLKEY = "__netHookUrl";

  var cfg = {
    tag: TAG,
    path: "/_/AiSandbox" + "AngularFrontend" + "/data/batch" + "execute",
    rpcs: {},
  };
  cfg.rpcs[ID_A] = { kind: "flag", index: 30, value: true };
  cfg.rpcs[ID_B] = {
    kind: "status",
    index: 1,
    value: 1,
    blocked: [4, 5, 6, 7, 8],
  };
  cfg.rpcs[ID_C] = {
    kind: "status",
    index: 1,
    value: 1,
    blocked: [4, 5, 6, 7, 8],
  };

  var st = { state: "armed", applied: 0, version: VER };
  var dbg = { captures: {}, applied: 0, errors: [], version: VER, spec: cfg };
  w.__netHookDebug = dbg;

  function emit() {
    try {
      var root = document.documentElement || document;
      if (root) root.setAttribute(ATTR, JSON.stringify(st));
      w.__netHookState = st;
    } catch (e) {}
  }

  function setPhase(next, applied) {
    st.state = next;
    if (typeof applied === "number") st.applied = applied;
    emit();
  }

  function matchUrl(url) {
    try {
      var u = new URL(url, location.href);
      if (u.origin !== location.origin) return false;
      return u.pathname.indexOf(cfg.path) === 0;
    } catch (e) {
      return false;
    }
  }

  function fill(arr, index) {
    while (arr.length <= index) arr.push(null);
  }

  function applyRule(data, rule) {
    var idx = rule.index;
    if (idx < 0) return false;
    if (idx >= data.length) fill(data, idx);

    if (rule.kind === "flag") {
      data[idx] = rule.value;
      return true;
    }

    if (rule.kind === "status") {
      var cur = data[idx];
      var isBlocked =
        cur == null || (rule.blocked && rule.blocked.indexOf(cur) !== -1);
      if (!isBlocked || cur === rule.value) return false;
      data[idx] = rule.value;
      return true;
    }

    return false;
  }

  function rewrite(text) {
    if (typeof text !== "string" || text.indexOf(cfg.tag) === -1) return text;

    var lines = text.split("\n");
    var total = 0;

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (line.slice(0, 2) !== "[[") continue;

      var arr;
      try {
        arr = JSON.parse(line);
      } catch (e) {
        continue;
      }
      if (!Array.isArray(arr)) continue;

      var appliedHere = 0;

      for (var j = 0; j < arr.length; j++) {
        var entry = arr[j];
        if (!Array.isArray(entry)) continue;
        if (entry[0] !== cfg.tag) continue;

        var rule = cfg.rpcs[entry[1]];
        if (!rule) continue;

        var data;
        try {
          data = JSON.parse(entry[2]);
        } catch (e) {
          continue;
        }
        if (!Array.isArray(data)) continue;

        dbg.captures[entry[1]] = data;

        if (applyRule(data, rule)) {
          entry[2] = JSON.stringify(data);
          appliedHere++;
          total++;
        }
      }

      if (appliedHere > 0) {
        var newJson = JSON.stringify(arr);
        var oldLine = line.replace(/\r$/, "");
        var prefixLine = (lines[i - 1] == null ? "" : lines[i - 1]).trim();

        var bytes = function (s) {
          return new TextEncoder().encode(s).length;
        };

        if (/^\d+$/.test(prefixLine)) {
          var prefix = Number(prefixLine);
          var delta;
          if (Math.abs(prefix - bytes(oldLine)) <= 2)
            delta = bytes(newJson) - bytes(oldLine);
          else if (Math.abs(prefix - oldLine.length) <= 2)
            delta = newJson.length - oldLine.length;
          else delta = bytes(newJson) - bytes(oldLine);
          lines[i - 1] = String(prefix + delta);
        }

        lines[i] = newJson;
      }
    }

    if (total > 0) {
      dbg.applied += total;
      setPhase("active", dbg.applied);
      try {
        console.info("[net] patched:", total);
      } catch (e) {}
    }

    return lines.join("\n");
  }

  var seen = false;

  function rewriteOnce(xhr, raw) {
    var cached = xhr[CACHE];
    if (cached !== undefined) return cached;

    var out = raw;

    if (typeof raw === "string" && raw.indexOf(cfg.tag) !== -1) {
      try {
        out = rewrite(raw);
        if (out !== raw) seen = true;
        else if (raw.indexOf(ID_A) !== -1 && !seen) {
          setPhase("unexpected payload shape");
        }
      } catch (e) {
        dbg.errors.push(String((e && e.message) || e));
        try {
          console.warn("[net] rewrite failed:", e && e.message);
        } catch (e2) {}
      }
    }

    xhr[CACHE] = out;
    return out;
  }

  try {
    var xp = XMLHttpRequest.prototype;
    var origOpen = xp.open;

    xp.open = function (method, url) {
      try {
        this[URLKEY] = url == null ? "" : String(url);
      } catch (e) {}
      return origOpen.apply(this, arguments);
    };

    var textDesc = Object.getOwnPropertyDescriptor(xp, "responseText");
    var respDesc = Object.getOwnPropertyDescriptor(xp, "response");

    if (textDesc && textDesc.get) {
      Object.defineProperty(xp, "responseText", {
        configurable: true,
        enumerable: textDesc.enumerable,
        get: function () {
          var raw = textDesc.get.call(this);
          if (this.readyState !== 4) return raw;
          if (!this[URLKEY] || !matchUrl(this[URLKEY])) return raw;
          return rewriteOnce(this, raw);
        },
      });
    }

    if (respDesc && respDesc.get) {
      Object.defineProperty(xp, "response", {
        configurable: true,
        enumerable: respDesc.enumerable,
        get: function () {
          var raw = respDesc.get.call(this);
          if (
            this.responseType &&
            this.responseType !== "" &&
            this.responseType !== "text"
          )
            return raw;
          if (this.readyState !== 4) return raw;
          if (!this[URLKEY] || !matchUrl(this[URLKEY])) return raw;
          return rewriteOnce(this, raw);
        },
      });
    }
  } catch (e) {
    dbg.errors.push("xhr-hook: " + ((e && e.message) || e));
  }

  try {
    var origFetch = window.fetch;
    if (typeof origFetch === "function") {
      window.fetch = function (input) {
        var self = this;
        var args = arguments;
        var url =
          typeof input === "string" ? input : (input && input.url) || "";

        return origFetch.apply(self, args).then(function (resp) {
          try {
            if (!matchUrl(url)) return resp;

            var clone = resp.clone();
            return clone
              .text()
              .then(function (txt) {
                var out;
                try {
                  out = rewrite(txt);
                } catch (e) {
                  return resp;
                }
                if (out === txt) return resp;

                var headers = new Headers(resp.headers);
                return new Response(out, {
                  status: resp.status,
                  statusText: resp.statusText,
                  headers: headers,
                });
              })
              .catch(function () {
                return resp;
              });
          } catch (e) {
            return resp;
          }
        });
      };
    }
  } catch (e) {
    dbg.errors.push("fetch-hook: " + ((e && e.message) || e));
  }

  function boot() {
    emit();
  }

  if (document.documentElement) boot();
  else document.addEventListener("DOMContentLoaded", boot, { once: true });

  setTimeout(emit, 0);
  setTimeout(emit, 1500);

  dbg.rewrite = rewrite;
})();
