
# use-module

This module enables you to import JS (ES6), CSS and HTML modules on almost any browser that supports ES6 modules.

## Setup
To add use-module to your project, just download `use-module.js` from the [releases](https://github.com/wazybr/use-module/releases) page, and place it in your project's folder.

After that, import it as a normal ES6 module in your HTML:

```html
<script type="module" src="./use-module.js">
```

or in your ES6 module:

```javascript
import use from "./use-module.js";
```

## Usage

And then you can import any other module using `use()`, like this:

```javascript
// Loads entire module or default export, if present, from ./module.js
const module = await use("./module.js");

// Loads a CSSStyleSheet from ./sheet.css
const styleSheet = await use("./sheet.css");

// Loads document from ./document.html
const doc = await use("./document.html");
```

## Base URL

When you call `use(moduleUrl)` use-module doesn't know the URL of the requesting module to resolve relative paths, so it uses the current `document.baseURI`. That means the current document's URL is most cases.
Most of the time you will want to import modules relative to yours. For those cases, you can pass a base URL to the `use()` function, like this:

```javascript
const module = await use("./module.js", "https://example.com/example/path");
```

or better yet, as ES6 modules can access their own URLs through `import.meta.url`, you can just do:

```javascript
const module = await use("./module.js", import.meta.url);
```

## Signatures

For a syntax better suited to your needs, you can call `use()` in two ways. Here's a breakdown of those signatures:

### `use(url[, baseUrl, options])`
- `url` *String or URL*: he URL of the desired module to load.
- `baseUrl` *String or URL (optional)*: the base URL for resolving relative paths. Defaults to `document.baseURI`.
- `options` *Object (optional)*
	- `default` *Boolean*: whether or not to directly return the module's default export if present instead of the entire module. Defaults to `true`.

Returns a `Promise` that resolves to the imported module or to it's default export, depending `options.default`.

### `use(url, options)`
- `url` *String or URL*: he URL of the desired module to load.
- `options` *Object (optional)*
	- `base` *String or URL (optional)*: the base URL for resolving relative paths. Defaults to `document.baseURI`.
	- `default` *Boolean*: whether or not to directly return the module's default export if present instead of the entire module. Defaults to `true`.

Returns a `Promise` that resolves to the imported module or to it's default export, depending `options.default`.

## Importing with HTML tag

In case you need to import a module, but don't want to use Javascript for it, you can use the `use-module` custom element. See:

```html
<!-- Import ./module.js -->
<use-module src="./module.js"></use-module>
```
If you want the default export of the imported module mapped to a global variable, you can do:

```html
<!-- Import ./module.js and put it's default export on window.mod -->
<use-module src="./module.js" as="mod"></use-module>
```

You can also map the entire module to a global variable:

```html
<!-- Import ./module.js and put all it's exports as an object on window.mod -->
<use-module src="./module.js" as="mod" default="no"></use-module>
```

## Security notes
This project is a simple tool developed for personal use in side projects at first, therefore security is not guaranteed. Feel free to raise concerns and open issues to discuss them. Pull requests fixing security holes are more than welcome, as any other improvement PR.

## License

Copyright &copy; 2019 Marlon Santos Macedo
MIT License. See [LICENSE](LICENSE) for details.