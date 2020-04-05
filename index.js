const map = new Map();
const urlAttributes = ["src", "href"];

const importsRegex = {
    static: new RegExp(/import(?:["'\s]*(?:[\w*${}\n\r\t, ]+)from\s*)?["'\s]["'\s](?<import>.*[@\w_-]+)["'\s]/, "g"),
    dynamic: new RegExp(/import\((?:["'\s]*(?:[\w*{}\n\r\t, ]+)\s*)?["'\s](?<import>.*(?:[@\w_-]+))["'\s].*\)/, 'g')
};

async function tryFetch(url) {
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) throw new Error(`Failed to fetch module: ${res.status}`);
    return res;
}

function replaceNextString(str, oldStr, newStr, start = 0) {
    const idx = str.indexOf(oldStr, start);
    return str.substring(0, idx) + newStr + str.substring(idx + oldStr.length);
}

function b64EncodeUnicode(str) {
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g,
        function toSolidBytes(match, p1) {
            return String.fromCharCode('0x' + p1);
    }));
}

function resolveHTMLUrls(doc, baseUrl) {
    for (let attr of urlAttributes) {
        for (let el of doc.querySelectorAll(`[${attr}]`)) {
            let url = el.getAttribute(attr);
            
            try {
                if (url) {
                    url = new URL(url, baseUrl);
                    el.setAttribute(attr, url.toString());
                }
            } catch (e) { }
        }
    }

    for (let template of doc.querySelectorAll("template")) {
        resolveHTMLUrls(template.content, baseUrl);
    }
}

function resolveJSUrls(js, baseUrl) {
    let match;
    
    for (let type in importsRegex) {
        match = importsRegex[type].exec(js);

        while (match) {
            const newUrl = new URL(match.groups.import, baseUrl);
            js = replaceNextString(js, match.groups.import, newUrl.toString(), match.index);
            match = importsRegex[type].exec(js);
        }
    }

    return js;
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
    if (!(window._tempDocs instanceof Map)) {
        window._tempDocs = new Map();
    }

    const encodedUrl = encodeURI(url.toString());
    window._tempDocs.set(encodedUrl, doc);
    
    let moduleJS = script.innerText;
    moduleJS = resolveJSUrls(moduleJS, url);

    const js = `import.meta.document = window._tempDocs.get("${encodedUrl}");
                import.meta.url = decodeURI("${encodedUrl}");
                ${moduleJS}`;

    const b64 = "data:text/javascript;base64," + b64EncodeUnicode(js);
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

    resolveHTMLUrls(doc, url);

    const base = document.createElement("base");
    base.href = url;
    doc.head.appendChild(base);

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

    if (map.has(url)) {
        return await map.get(url);
    }
    
    try {
        const promise = loadModule(url, options.default);
        map.set(url, promise);
        return await promise;
    } catch (e) {
        map.delete(url);
        throw e;
    }
}

class UseModuleElement extends HTMLElement {
    constructor() {
        super();
    }

    async connectedCallback() {
        if (!this.success && !this.loading) {
            this.loading = true;

            if (this.parentElement !== document.head) {
                document.head.appendChild(this);
            }

            let exports;

            const src = this.getAttribute("src");
            const as = this.getAttribute("as");
            let def = this.getAttribute("default") || "";
            let adopt = this.getAttribute("adopt") || "";

            def = def.trim().toLowerCase() !== "no" && def.trim().toLowerCase() !== "false";
            adopt = adopt.trim().toLowerCase() !== "no" && adopt.trim().toLowerCase() !== "false";
            
            const exports = await use(src, { base: document.baseURI, default: def });

            if (as) {
                window[as] = exports;
            }

            if (adopt && exports instanceof CSSStyleSheet) {
                const root = this.getRootNode();
                root.adoptedStyleSheets = [...root.adoptedStyleSheets, exports];
            }

            this.success = true;
            this.loading = false;
        }
    }
}

customElements.define("use-module", UseModuleElement);

for (let script of document.scripts) {
    if (script.src === import.meta.url) {
        window.use = use;
        break;
    }
}