const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..", "..");

class FakeElement {
  constructor(tagName, document) {
    this.tagName = tagName.toUpperCase();
    this.ownerDocument = document;
    this.style = {};
    this.className = "";
    this.id = "";
    this.listeners = new Map();
    this.children = [];
    this.parentNode = null;
    this._innerHTML = "";
  }

  get classList() {
    const self = this;
    return {
      contains(name) {
        return self.className.split(/\s+/).filter(Boolean).includes(name);
      },
      add(...names) {
        const values = new Set(self.className.split(/\s+/).filter(Boolean));
        names.forEach((name) => values.add(name));
        self.className = [...values].join(" ");
      },
      remove(...names) {
        const values = new Set(self.className.split(/\s+/).filter(Boolean));
        names.forEach((name) => values.delete(name));
        self.className = [...values].join(" ");
      }
    };
  }

  set innerHTML(value) {
    this._innerHTML = value;
    const ids = [...String(value).matchAll(/id="([^"]+)"/g)].map((match) => match[1]);
    this.children = ids.map((id) => {
      const child = new FakeElement("div", this.ownerDocument);
      child.id = id;
      child.parentNode = this;
      this.ownerDocument.elementsById.set(id, child);
      return child;
    });
  }

  get innerHTML() {
    return this._innerHTML;
  }

  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    if (child.id) this.ownerDocument.elementsById.set(child.id, child);
    return child;
  }

  addEventListener(type, handler, options) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push({ handler, options });
  }

  dispatch(type, extra = {}) {
    const event = {
      type,
      target: extra.target || this,
      currentTarget: this,
      preventDefault() {
        this.defaultPrevented = true;
      },
      stopPropagation() {
        this.propagationStopped = true;
      },
      ...extra
    };
    for (const { handler } of this.listeners.get(type) || []) handler(event);
    return event;
  }
}

class FakeDocument {
  constructor() {
    this.elementsById = new Map();
    this.body = new FakeElement("body", this);
    this.player = new FakeElement("div", this);
    this.player.id = "movie_player";
    this.body.appendChild(this.player);
  }

  createElement(tagName) {
    return new FakeElement(tagName, this);
  }

  querySelector(selector) {
    if (selector === "#movie_player") return this.player;
    return null;
  }

  getElementById(id) {
    return this.elementsById.get(id) || null;
  }

  contains(node) {
    let current = node;
    while (current) {
      if (current === this.body) return true;
      current = current.parentNode;
    }
    return false;
  }
}

function loadSubtitleView() {
  const document = new FakeDocument();
  const context = {
    document,
    window: null,
    console,
    getComputedStyle() {
      return { position: "relative" };
    }
  };
  context.window = context;
  context.__SubSync = {
    settings: { get: () => true },
    interactiveText: { attach() {} },
    drag: { attach() {} }
  };
  const filename = path.join(root, "src", "components", "subtitle_view.js");
  vm.runInNewContext(fs.readFileSync(filename, "utf8"), context, { filename });
  context.__SubSync.subtitleView.render(null, { learn: "hello", known: "안녕" });
  return { document, subtitleView: context.__SubSync.subtitleView };
}

test("caption CSS does not move when YouTube controls toggle autohide", () => {
  const cssPath = path.join(root, "styles", "subtitle.css");
  const css = fs.readFileSync(cssPath, "utf8");

  assert.doesNotMatch(css, /\.ytp-autohide\s+\.subsync-video-caption-overlay/);
  assert.match(css, /\.subsync-video-caption-overlay[\s\S]*bottom:\s*60px/);
});

test("double-clicking the video caption restores its default position", () => {
  const { document } = loadSubtitleView();
  const overlay = document.getElementById("subsync-video-caption-overlay");
  assert.ok(overlay);

  overlay.style.left = "280px";
  overlay.style.top = "190px";
  overlay.style.right = "auto";
  overlay.style.bottom = "auto";
  overlay.style.transform = "none";

  const event = overlay.dispatch("dblclick");

  assert.equal(event.defaultPrevented, true);
  assert.equal(overlay.style.left, "");
  assert.equal(overlay.style.top, "");
  assert.equal(overlay.style.right, "");
  assert.equal(overlay.style.bottom, "");
  assert.equal(overlay.style.transform, "");
});
