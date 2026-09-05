const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const filename = path.join(__dirname, "content_main.js");
const source = fs.readFileSync(filename, "utf8");

function createHarness() {
  const listeners = new Map();
  const window = {
    addEventListener(type, handler) {
      listeners.set(type, handler);
    },
    postMessage() {}
  };
  const document = {
    addEventListener() {}
  };
  const buildCalls = [];
  const highlightCalls = [];
  let syncCallback = null;
  const video = { currentTime: 0, paused: false, ended: false };
  let videoId = "video-1";

  const SubSync = {
    getVideoId: () => videoId,
    settings: {
      async init() {},
      get() {
        return true;
      }
    },
    layout: {
      async ensureRoot() {},
      getSubtitleArea() {
        return null;
      },
      getTutorArea() {
        return null;
      }
    },
    scriptPanel: {
      ensureContainer() {},
      setSubtitles() {},
      highlightTime(...args) {
        highlightCalls.push(args);
      }
    },
    tutorChat: {
      init() {},
      triggerProactiveIfNeed() {}
    },
    player: {
      getVideo() {
        return video;
      }
    },
    subtitleView: {
      render() {},
      clear() {}
    },
    async buildSubtitlesFromUrl(video, url, options) {
      buildCalls.push({ video, url, options });
      return [{ video_id: video, timestamp: 0, end_timestamp: 1, learn: "hello" }];
    }
  };

  const context = {
    console,
    document,
    window,
    setInterval(callback) {
      syncCallback = callback;
      return 1;
    },
    clearInterval() {},
    setTimeout() {
      return 1;
    },
    clearTimeout() {}
  };
  context.__SubSync = SubSync;
  window.__SubSync = SubSync;
  vm.runInNewContext(source, context, { filename });

  return {
    SubSync,
    buildCalls,
    highlightCalls,
    emit(data) {
      const handler = listeners.get("message");
      assert.ok(handler, "content_main must register a message listener");
      handler({ source: window, data });
    },
    setVideoId(nextVideoId) {
      videoId = nextVideoId;
    },
    setPlayback({ currentTime = video.currentTime, paused = video.paused, ended = video.ended } = {}) {
      video.currentTime = currentTime;
      video.paused = paused;
      video.ended = ended;
    },
    tick() {
      assert.ok(syncCallback, "content_main must register the sync loop");
      syncCallback();
    }
  };
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setImmediate(resolve));
}

test("defers subtitle building until track metadata arrives", async () => {
  const harness = createHarness();

  harness.emit({
    source: "SUBSYNC",
    type: "TIMEDTEXT_URL",
    url: "https://www.youtube.com/api/timedtext?captured=1"
  });
  await flush();
  assert.equal(harness.buildCalls.length, 0);

  harness.emit({
    source: "SUBSYNC",
    type: "TRACKS",
    tracks: [{ lang: "en" }, { lang: "ko" }]
  });
  await flush();

  assert.equal(harness.buildCalls.length, 1);
  assert.equal(
    harness.buildCalls[0].options.tracks.map((track) => track.lang).join(","),
    "en,ko"
  );
});

test("does not start a second build for the same video and URL", async () => {
  const harness = createHarness();
  harness.emit({ source: "SUBSYNC", type: "TRACKS", tracks: [{ lang: "en" }] });
  harness.emit({
    source: "SUBSYNC",
    type: "TIMEDTEXT_URL",
    url: "https://www.youtube.com/api/timedtext?captured=1"
  });
  harness.emit({
    source: "SUBSYNC",
    type: "TIMEDTEXT_URL",
    url: "https://www.youtube.com/api/timedtext?captured=1"
  });
  await flush();

  assert.equal(harness.buildCalls.length, 1);
});

test("paused playback keeps the current Script row focused without auto-scroll tracking", async () => {
  const harness = createHarness();
  harness.emit({ source: "SUBSYNC", type: "TRACKS", tracks: [{ lang: "en" }] });
  harness.emit({
    source: "SUBSYNC",
    type: "TIMEDTEXT_URL",
    url: "https://www.youtube.com/api/timedtext?captured=1"
  });
  await flush();
  assert.equal(harness.buildCalls.length, 1);

  harness.setPlayback({ currentTime: 0.5, paused: false });
  harness.tick();
  assert.equal(harness.highlightCalls.at(-1)[1].autoScroll, true);

  harness.setPlayback({ currentTime: 0.5, paused: true });
  harness.tick();
  assert.equal(harness.highlightCalls.at(-1)[1].autoScroll, false);
});
