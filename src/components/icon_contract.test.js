const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..", "..");
const iconDir = path.join(root, "assets", "icons");
const layout = fs.readFileSync(path.join(root, "src", "components", "layout.js"), "utf8");
const scriptPanel = fs.readFileSync(path.join(root, "src", "components", "script_panel.js"), "utf8");
const tutorChat = fs.readFileSync(path.join(root, "src", "components", "tutor_chat.js"), "utf8");
const iconAssets = fs.readFileSync(path.join(root, "src", "core", "icon_assets.js"), "utf8");
const iconCss = fs.readFileSync(path.join(root, "styles", "icons.css"), "utf8");
const searchSvg = fs.readFileSync(path.join(iconDir, "search.svg"), "utf8");
const collapseSvg = fs.readFileSync(path.join(iconDir, "collapse.svg"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));

const icons = [
  "video-learning",
  "ai-tutor",
  "vocabulary",
  "learning-history",
  "settings",
  "script",
  "search",
  "collapse"
];

test("the original SubSync icon set contains eight local SVG assets", () => {
  for (const name of icons) {
    const svg = fs.readFileSync(path.join(iconDir, `${name}.svg`), "utf8");
    assert.match(svg, /^<svg\b/);
    assert.match(svg, /viewBox="0 0 24 24"/);
    assert.match(svg, /stroke=/);
    assert.doesNotMatch(svg, /<script\b|<image\b|(?:href|xlink:href)=["']https?:\/\//i);
  }
});

test("icon assets use an extension URL helper and are exposed to YouTube", () => {
  assert.match(iconAssets, /chrome\.runtime\.getURL/);
  assert.match(iconAssets, /assets\/icons/);
  assert.ok(manifest.content_scripts[1].js.includes("src/core/icon_assets.js"));
  assert.ok(
    manifest.content_scripts[1].js.indexOf("src/core/icon_assets.js") <
      manifest.content_scripts[1].js.indexOf("src/components/layout.js")
  );
  assert.deepEqual(manifest.web_accessible_resources, [
    {
      resources: ["assets/icons/*.svg"],
      matches: ["https://www.youtube.com/*"]
    }
  ]);
});

test("the six feature controls use the original SVG icon set", () => {
  assert.match(layout, /SubSync\.icon\("video-learning"/);
  assert.match(layout, /SubSync\.icon\("ai-tutor"/);
  assert.match(layout, /SubSync\.icon\("vocabulary"/);
  assert.match(layout, /SubSync\.icon\("learning-history"/);
  assert.match(layout, /SubSync\.icon\("settings"/);
  assert.match(layout, /SubSync\.icon\("script"/);
  assert.match(scriptPanel, /SubSync\.icon\("script"/);
  assert.match(scriptPanel, /SubSync\.icon\("search"/);
  assert.match(scriptPanel, /SubSync\.icon\("collapse"/);
  assert.match(tutorChat, /SubSync\.icon\("ai-tutor"/);

  for (const legacyIcon of ["📺", "🤖", "⭐", "📊", "⚙️", "📜"]) {
    assert.doesNotMatch(layout, new RegExp(legacyIcon));
  }
  assert.doesNotMatch(scriptPanel, /<span class="subsync-script-icon">📜<\/span>/);
  assert.doesNotMatch(scriptPanel, />🔍<\/button>/);
  assert.doesNotMatch(scriptPanel, />⌃<\/button>/);
  assert.doesNotMatch(tutorChat, /<div class="subsync-tutor-header">🤖/);
});

test("icon CSS keeps SVG sizing and state styling scoped to SubSync controls", () => {
  assert.match(iconCss, /\.subsync-ui-icon\s*\{/);
  assert.match(iconCss, /width:\s*16px/);
  assert.match(iconCss, /height:\s*16px/);
  assert.match(iconCss, /\.subsync-nav-btn[^}]*\.subsync-ui-icon/);
  assert.match(iconCss, /\.subsync-nav-btn\.active[^}]*\.subsync-ui-icon/);
  assert.match(iconCss, /\.subsync-script-panel-container\s+\.subsync-script-collapse-btn[\s\S]*left:\s*50%/);
  assert.match(iconCss, /subsync-script-collapse-collapsed/);
});

test("search and collapse icons use the neutral circle-chevron treatment", () => {
  assert.match(searchSvg, /stroke="#BFC0C4"/);
  assert.match(searchSvg, /stroke-width="2"/);
  assert.match(collapseSvg, /stroke="#BFC0C4"/);
  assert.match(collapseSvg, /stroke-width="2\.1"/);
  assert.match(collapseSvg, /<circle[^>]*cx="12"[^>]*cy="12"/);
  assert.match(collapseSvg, /d="M9\.2 10\.5 12 13\.3 14\.8 10\.5"/);
  assert.match(iconCss, /\.subsync-script-panel-header\s*\{[\s\S]*padding-bottom:\s*26px/);
  assert.match(iconCss, /\.subsync-script-panel-container\s+\.subsync-script-collapse-btn[\s\S]*bottom:\s*4px/);
  assert.match(iconCss, /\.subsync-script-panel-container\s+\.subsync-script-collapse-btn[\s\S]*width:\s*22px/);
  assert.match(iconCss, /\.subsync-script-panel-container\s+\.subsync-script-collapse-btn[\s\S]*height:\s*22px/);
  assert.match(iconCss, /\.subsync-script-collapse-btn\s+\.subsync-script-collapse-icon\s*\{[\s\S]*width:\s*22px/);
  assert.match(iconCss, /\.subsync-script-collapse-btn\s+\.subsync-script-collapse-icon\s*\{[\s\S]*height:\s*22px/);
  assert.match(iconCss, /\.subsync-script-search-icon\s*\{[\s\S]*width:\s*18px/);
  assert.match(iconCss, /\.subsync-script-search-icon\s*\{[\s\S]*height:\s*18px/);
  assert.match(iconCss, /\.subsync-script-panel-container\s+\.subsync-script-collapse-btn[\s\S]*background:\s*transparent/);
  assert.match(iconCss, /subsync-script-panel-preparing/);
  assert.match(iconCss, /\.subsync-script-panel-container\.subsync-script-panel-preparing\s*\{[\s\S]*transform:\s*none/);
  assert.match(iconCss, /\.subsync-script-panel-container\.subsync-script-panel-preparing\s+\.subsync-script-list\s*\{[\s\S]*max-height:\s*12px/);
  assert.match(iconCss, /\.subsync-script-panel-container\.subsync-script-panel-preparing\s+\.subsync-script-list\s*\{[\s\S]*padding:\s*4px\s+10px\s+0/);
  assert.match(iconCss, /\.subsync-script-panel-container\.subsync-script-panel-preparing\s+\.subsync-script-list\s*\{[\s\S]*overflow:\s*hidden/);
  assert.match(iconCss, /\.subsync-script-panel-container\.subsync-script-panel-preparing\s+\.subsync-script-list::before/);
  assert.match(iconCss, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*\.subsync-script-panel-container\.subsync-script-panel-collapsed\s+\.subsync-script-list[\s\S]*transition:\s*none/);
  assert.doesNotMatch(iconCss, /subsync-script-panel-preparing[\s\S]*transform:\s*translateY\(-2px\)/);
  assert.match(scriptPanel, /mouseenter/);
  assert.match(scriptPanel, /mouseleave/);
  assert.doesNotMatch(scriptPanel, /collapseFocused/);
  assert.doesNotMatch(scriptPanel, /addEventListener\("focus"/);
  assert.doesNotMatch(scriptPanel, /addEventListener\("blur"/);
});
