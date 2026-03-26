/**
 * Node.js DOM shim for running the Pomax mahjong engine server-side.
 * Must be imported before any engine code.
 */

// --- Fake CSS Style ---
class Style {
  constructor() { this.properties = {}; }
  setProperty(name, value) { this.properties[name] = value; }
}

// --- Fake classList ---
class Classlist {
  constructor() { this.classes = []; }
  add(v) { if (!this.classes.includes(v)) this.classes.push(v); }
  remove(v) { const pos = this.classes.indexOf(v); if (pos > -1) this.classes.splice(pos, 1); }
  toggle(v) { if (this.contains(v)) this.remove(v); else this.add(v); }
  contains(v) { return this.classes.includes(v); }
}

// --- Fake Element ---
class Element {
  constructor(tag) {
    this.nodeName = (tag || 'div').toUpperCase();
    this.classList = new Classlist();
    this.dataset = {};
    this.attributes = {};
    this.children = [];
    this.events = {};
    this.parentNode = null;
    this.style = new Style();
    this.innerHTML = '';
    this.id = '';
  }
  focus() {}
  setAttribute(a, v) { this.attributes[a] = v; this.dataset[a] = v; }
  removeAttribute(a) { delete this.attributes[a]; delete this.dataset[a]; }
  getAttribute(a) { return this.attributes[a]; }
  querySelector() { return new Element('div'); }
  querySelectorAll(qs) {
    if (qs === '.player-wind') return [0, 1, 2, 3].map(() => new Element('div'));
    return [new Element('div')];
  }
  appendChild(e) { this.children.push(e); e.parentNode = this; }
  append(e) { this.appendChild(e); }
  removeChild(e) { const pos = this.children.indexOf(e); if (pos > -1) this.children.splice(pos, 1); }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); }
  addEventListener() {}
  removeEventListener() {}
  play() {}
  click() {}
  cloneNode() { return new Element(this.nodeName); }
}

// --- Fake HTMLElement ---
class HTMLElement extends Element {
  constructor() { super('div'); }
}

// --- Fake customElements registry ---
const customElementsRegistry = {};
const customElements = {
  define(name, cls) { customElementsRegistry[name] = cls; },
  get(name) { return customElementsRegistry[name]; },
};

// --- Fake document ---
const document = {
  body: new Element('body'),
  createElement(tag) { return new Element(tag); },
  addEventListener() {},
  removeEventListener() {},
  querySelector() { return new Element('div'); },
  querySelectorAll(qs) {
    if (qs === '.player-wind') return [0, 1, 2, 3].map(() => new Element('div'));
    return [new Element('div')];
  },
};

// --- Fake localStorage ---
const localStorage = {
  _data: {},
  getItem(key) { return this._data[key] ?? null; },
  setItem(key, value) { this._data[key] = String(value); },
  removeItem(key) { delete this._data[key]; },
};

// --- Fake location ---
const location = {
  search: '',
  href: '',
  hostname: 'localhost',
};

// --- Install globals ---
globalThis.HTMLElement = HTMLElement;
globalThis.Element = Element;
globalThis.customElements = customElements;
globalThis.document = document;
globalThis.localStorage = localStorage;
globalThis.location = location;

// --- Array prototype extensions (used by Pomax engine) ---
if (!Array.prototype.last) {
  Array.prototype.last = function () {
    return this[this.length - 1];
  };
}

if (!Array.prototype.asyncAll) {
  Array.prototype.asyncAll = async function (fn) {
    return await Promise.all(
      this.map(
        (e) =>
          new Promise((resolve) => {
            fn(e);
            resolve();
          })
      )
    );
  };
}

export { Element, HTMLElement, Classlist, Style, document, localStorage, customElements };
