const map = new Map();

async function tryFetch(url) {
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) throw new Error(`Failed to fetch module: ${res.status}`);
    return res;
}

async function loadCSSModule(url, def) {
    const res = await tryFetch(url);
    const css = await res.text();
    const styleSheet = new CSSStyleSheet();
    styleSheet.replaceSync(css);

    if (def) {
        return styleSheet;
    } else {
        return { default: styleSheet };
    }
}

async function loadJSModule(url, def) {
    const exports = await import(url);
    
    if (def && "default" in exports) {
        return exports.default;
    } else {
        return exports;
    }
}

async function loadInlineJSModule(script, doc, url) {
    if (!(typeof(window._tempDocs) instanceof Map)) {
        window._tempDocs = new Map();
    }

    const encodedUrl = encodeURI(url.toString());
    window._tempDocs.set(encodedUrl, doc);

    const js = `import.meta.document = window._tempDocs.get("${encodedUrl}");
                import.meta.url = decodeURI("${encodedUrl}");
                ${script.innerText}`;

    const b64 = "data:text/javascript;base64," + btoa(js);
    const exports = await import(b64);

    if (window._tempDocs.size === 0) {
        delete window._tempDocs;
    }

    return exports;
}

async function loadHTMLModule(url, def) {
    const res = await tryFetch(url);
    const html = await res.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const exports = { };

    // TODO: check for scripts (only module types)
    for (let script of doc.querySelectorAll("script")) {
        if (script.type === "module") {
            Object.assign(exports, await loadInlineJSModule(script, doc, url));
            script.remove();
        } else {
            throw new Error("Only module-type inline scripts are allowed on HTML Modules");
        }
    }

    if (Object.keys(exports).length === 0) {
        exports.default = doc;
    }

    if (def && "default" in exports) {
        return exports.default;
    } else {
        return exports;
    }
}

async function loadModule(url, def = true) {
    const res = await fetch(url, { method: "HEAD" });
    if (!res.ok) throw new Error(`Failed to fetch module type: ${res.status}`);
    
    if (res.headers.has("Content-Type")) {
        const mime = res.headers.get("Content-Type").split(";")[0];
        switch (mime) {
            case "text/javascript":
            case "application/javascript": {
                return await loadJSModule(url, def);
            }
            
            case "text/css": {
                return await loadCSSModule(url, def);
            }

            case "text/html": {
                return await loadHTMLModule(url, def);
            }

            default: {
                throw new TypeError(`Invalid MIME type: ${mime}`);
            }
        }
    } else {
        throw new Error("Failed to fetch module type");
    }
}

export default async function use(url, baseUrl, options) {
    if (baseUrl && typeof(baseUrl) === "object" && !(baseUrl instanceof URL)) {
        options = Object.assign({}, baseUrl);
    } else {
        options = Object.assign({ base: baseUrl }, options);
    }

    if (!(url instanceof URL)) {
        url = new URL(url, options.base || document.baseURI);
    }

    url = url.toString();

    console.log("has", map.has(url));
    if (map.has(url)) {
        return await map.get(url);
    }
    
    try {
        const promise = loadModule(url, options.default);
        map.set(url, promise);
        return await promise;
    } catch {
        console.log("deleting");
        map.delete(url);
    }
}

class UseModuleElement extends HTMLElement {
    constructor() {
        super();
    }

    connectedCallback() {
        (async () => {
            if (!this.success && !this.loading) {
                this.loading = true;

                if (this.parentElement !== document.head) {
                    document.head.appendChild(this);
                }

                const src = this.getAttribute("src");
                const as = this.getAttribute("as");
                let def = this.getAttribute("default") || "";

                def = def.trim().toLowerCase() !== "no" && def.trim().toLowerCase() !== "false";
                
                if (as) {
                    window[as] = await use(src, { base: document.baseURI, default: def });
                } else {
                    await use(src, { base: document.baseURI, default: def });
                }

                this.success = true;
                this.loading = false;
            }
        })();
    }
}

customElements.define("use-module", UseModuleElement);