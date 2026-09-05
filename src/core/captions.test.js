const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const filename = path.join(__dirname, "captions.js");
const source = fs.readFileSync(filename, "utf8");

function response(events) {
  return {
    ok: true,
    async text() {
      return JSON.stringify({ events });
    }
  };
}

function loadCaptions(fetchImpl) {
  const context = {
    console,
    URL,
    location: { origin: "https://www.youtube.com" },
    fetch: fetchImpl
  };
  context.window = context;
  context.__SubSync = {};
  vm.runInNewContext(source, context, { filename });
  return context.__SubSync;
}

function normalEvents() {
  return [
    { tStartMs: 0, dDurationMs: 900, segs: [{ utf8: "First sentence." }] },
    { tStartMs: 1000, dDurationMs: 900, segs: [{ utf8: "Second sentence." }] },
    { tStartMs: 2000, dDurationMs: 900, segs: [{ utf8: "Third sentence." }] }
  ];
}

test("empty track metadata requests the source language directly", async () => {
  const calls = [];
  const wholeTranscript = "A ".repeat(1200);
  const SubSync = loadCaptions(async (url) => {
    calls.push(url);
    const parsed = new URL(url);
    if (parsed.searchParams.get("tlang") === "en") {
      return response([
        { tStartMs: 129, dDurationMs: 827000, segs: [{ utf8: wholeTranscript }] }
      ]);
    }
    return response(normalEvents());
  });

  const subtitles = await SubSync.buildSubtitlesFromUrl(
    "fixture",
    "https://www.youtube.com/api/timedtext?x=1",
    { tracks: [], learnLang: "en", knownLang: "ko" }
  );

  const learnRequest = new URL(calls[0]);
  assert.equal(learnRequest.searchParams.get("lang"), "en");
  assert.notEqual(learnRequest.searchParams.get("tlang"), "en");
  assert.equal(subtitles.length, 3);
  assert.ok(Math.max(...subtitles.map((item) => item.learn.length)) < 500);
});
