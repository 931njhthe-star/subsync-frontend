const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const settingsView = fs.readFileSync(path.join(__dirname, "settings_view.js"), "utf8");

const team = [
  ["노지훈", "팀장", "PM &amp; BE", "https://github.com/931njhthe-star"],
  ["김훈", "팀원", "FE", "https://github.com/teach97"],
  ["전소예", "팀원", "DB", "https://github.com/soyedev"],
  ["박서윤", "팀원", "BE", "https://github.com/seoyun-park"],
  ["최경락", "팀원 (기록자)", "AI", "https://github.com/Kyeongrak-Choi"]
];

test("Settings About section exposes the cohort and team information", () => {
  assert.match(settingsView, /subsync-about-section/);
  assert.match(settingsView, />About<\/div>/);
  assert.match(settingsView, /엔코아 멀티 에이전트 AI 오케스트레이션 2기/);

  for (const [name, role, area, github] of team) {
    assert.match(settingsView, new RegExp(name));
    assert.match(settingsView, new RegExp(role.replace(/[()]/g, "\\$&")));
    assert.match(settingsView, new RegExp(area.replace(/[+]/g, "\\$&")));
    assert.match(settingsView, new RegExp(github.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  }
});

test("Settings About section links to the published privacy policy safely", () => {
  assert.match(
    settingsView,
    /https:\/\/931njhthe-star\.github\.io\/subsync-frontend\/privacy\.html/
  );
  assert.match(settingsView, /target="_blank"/);
  assert.match(settingsView, /rel="noopener noreferrer"/);
  assert.match(settingsView, /개인정보\s*처리방침/);
});
