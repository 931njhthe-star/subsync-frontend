const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const filename = path.join(__dirname, "content_main.js");
const source = fs.readFileSync(filename, "utf8");

function createHarness(options = {}) {
  const listeners = new Map();
  const documentListeners = new Map();
  const intervalCallbacks = [];
  const subtitleArea = { innerHTML: "", textContent: "", dataset: {} };
  const scriptSubtitleCalls = [];
  const subtitleClearCalls = [];
  const lifecycle = [];
  const requestMessages = [];
  const pageFetchRequests = [];
  const window = {
    addEventListener(type, handler) {
      listeners.set(type, handler);
    },
    postMessage(message) {
      if (message && message.source === "SUBSYNC_REQUEST") {
        requestMessages.push(message);
      }
      if (message && message.source === "SUBSYNC_PAGE_FETCH_REQUEST") {
        pageFetchRequests.push(message);
        if (options.pageFetchResult) {
          const handler = listeners.get("message");
          const result = typeof options.pageFetchResult === "function"
            ? options.pageFetchResult(message)
            : options.pageFetchResult;
          handler({
            source: window,
            data: {
              ...(result || {}),
              source: "SUBSYNC",
              type: "PAGE_FETCH_RESULT",
              fetchId: message.fetchId,
              videoId: message.videoId,
              requestId: message.requestId
            }
          });
        }
      }
    }
  };
  const document = {
    addEventListener(type, handler) {
      documentListeners.set(type, handler);
    }
  };
  const buildCalls = [];
  const highlightCalls = [];
  const renderCalls = [];
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
      async ensureRoot() {
        lifecycle.push("ensureRoot");
      },
      getSubtitleArea() {
        return subtitleArea;
      },
      getTutorArea() {
        return null;
      }
    },
    scriptPanel: {
      ensureContainer() {
        lifecycle.push("ensureContainer");
      },
      setSubtitles(subtitles) {
        lifecycle.push("setSubtitles");
        scriptSubtitleCalls.push(subtitles);
      },
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
      render(...args) {
        renderCalls.push(args);
      },
      clear() {
        subtitleClearCalls.push(true);
      }
    },
    async buildSubtitlesFromUrl(video, url, buildOptions) {
      buildCalls.push({ video, url, options: buildOptions });
      if (options.buildStatus && typeof buildOptions.onStatus === "function") {
        buildOptions.onStatus(options.buildStatus);
      }
      if (options.buildImplementation) {
        return options.buildImplementation(video, url, buildOptions);
      }
      return options.builtSubtitles || [
        { video_id: video, timestamp: 0, end_timestamp: 1, learn: "hello" }
      ];
    }
  };

  const context = {
    console,
    document,
    window,
    setInterval(callback) {
      intervalCallbacks.push(callback);
      syncCallback = callback;
      return intervalCallbacks.length;
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
    renderCalls,
    scriptSubtitleCalls,
    subtitleClearCalls,
    lifecycle,
    subtitleArea,
    pageFetchRequests,
    emit(data) {
      const handler = listeners.get("message");
      assert.ok(handler, "content_main must register a message listener");
      const request = requestMessages.at(-1) || {};
      handler({
        source: window,
        data: {
          videoId: data.videoId ?? request.videoId,
          requestId: data.requestId ?? request.requestId,
          ...data
        }
      });
    },
    setVideoId(nextVideoId) {
      videoId = nextVideoId;
    },
    setPlayback({ currentTime = video.currentTime, paused = video.paused, ended = video.ended } = {}) {
      video.currentTime = currentTime;
      video.paused = paused;
      video.ended = ended;
    },
    pollVideo() {
      assert.ok(intervalCallbacks[0], "content_main must register the video watcher");
      intervalCallbacks[0]();
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
  await flush();

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
  await flush();
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
  await flush();
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

test("playback changes the rendered subtitle when crossing into the next cue", async () => {
  const first = { timestamp: 0, end_timestamp: 1, learn: "first subtitle" };
  const second = { timestamp: 1, end_timestamp: 2, learn: "second subtitle" };
  const harness = createHarness({ builtSubtitles: [first, second] });
  await flush();

  harness.emit({ source: "SUBSYNC", type: "TRACKS", tracks: [{ lang: "en" }] });
  harness.emit({
    source: "SUBSYNC",
    type: "TIMEDTEXT_URL",
    url: "https://www.youtube.com/api/timedtext?captured=1"
  });
  await flush();

  harness.setPlayback({ currentTime: 0.5, paused: false });
  harness.tick();
  harness.setPlayback({ currentTime: 1.5, paused: false });
  harness.tick();

  assert.equal(harness.renderCalls.length, 2);
  assert.equal(harness.renderCalls[0][1], first);
  assert.equal(harness.renderCalls[1][1], second);
});

test("clears rendered subtitles when navigation detects a new video", async () => {
  const harness = createHarness();
  await flush();

  const clearCountBeforeNavigation = harness.subtitleClearCalls.length;
  harness.setVideoId("video-2");
  harness.pollVideo();
  await flush();

  assert.equal(harness.subtitleClearCalls.length, clearCountBeforeNavigation + 1);
  assert.equal(harness.scriptSubtitleCalls.at(-1).length, 0);
  assert.equal(harness.subtitleArea.innerHTML, "");
});

test("mounts the Script container before clearing its subtitles", async () => {
  const harness = createHarness();
  await flush();

  assert.deepEqual(harness.lifecycle.slice(0, 3), [
    "ensureRoot",
    "ensureContainer",
    "setSubtitles"
  ]);
});

test("exposes a refresh action that reinitializes the current video", async () => {
  const harness = createHarness();
  await flush();

  assert.equal(typeof harness.SubSync.refresh, "function");
  const clearCountBeforeRefresh = harness.subtitleClearCalls.length;
  const refreshPromise = harness.SubSync.refresh();
  await flush();
  harness.emit({ source: "SUBSYNC", type: "TRACKS", tracks: [{ lang: "en" }] });
  harness.emit({
    source: "SUBSYNC",
    type: "TIMEDTEXT_URL",
    url: "https://www.youtube.com/api/timedtext?v=video-1"
  });
  await refreshPromise;
  await flush();

  assert.equal(harness.subtitleClearCalls.length, clearCountBeforeRefresh + 1);
});

test("ignores caption metadata and URLs from the previous SPA video", async () => {
  const harness = createHarness();
  await flush();

  harness.setVideoId("video-2");
  harness.pollVideo();
  await flush();

  harness.emit({
    source: "SUBSYNC",
    type: "TRACKS",
    videoId: "video-1",
    tracks: [{ lang: "en" }]
  });
  harness.emit({
    source: "SUBSYNC",
    type: "TIMEDTEXT_URL",
    videoId: "video-1",
    url: "https://www.youtube.com/api/timedtext?v=video-1"
  });
  await flush();
  assert.equal(harness.buildCalls.length, 0);

  harness.emit({
    source: "SUBSYNC",
    type: "TRACKS",
    videoId: "video-2",
    tracks: [{ lang: "en" }]
  });
  harness.emit({
    source: "SUBSYNC",
    type: "TIMEDTEXT_URL",
    videoId: "video-2",
    url: "https://www.youtube.com/api/timedtext?v=video-2"
  });
  await flush();

  assert.equal(harness.buildCalls.length, 1);
  assert.equal(harness.buildCalls[0].video, "video-2");
});

test("allows the same caption source to retry after an empty build", async () => {
  const harness = createHarness({ builtSubtitles: [] });
  await flush();

  harness.emit({ source: "SUBSYNC", type: "TRACKS", tracks: [{ lang: "en" }] });
  harness.emit({
    source: "SUBSYNC",
    type: "TIMEDTEXT_URL",
    url: "https://www.youtube.com/api/timedtext?v=video-1"
  });
  await flush();
  assert.equal(harness.buildCalls.length, 1);

  harness.emit({
    source: "SUBSYNC",
    type: "TIMEDTEXT_URL",
    url: "https://www.youtube.com/api/timedtext?v=video-1"
  });
  await flush();

  assert.equal(harness.buildCalls.length, 2);
});

test("shows a classified HTTP 429 caption failure in the subtitle panel", async () => {
  const harness = createHarness({
    builtSubtitles: [],
    buildStatus: {
      state: "error",
      phase: "learn",
      code: "http",
      httpStatus: 429
    }
  });
  await flush();

  harness.emit({ source: "SUBSYNC", type: "TRACKS", tracks: [{ lang: "en" }] });
  harness.emit({
    source: "SUBSYNC",
    type: "TIMEDTEXT_URL",
    url: "https://www.youtube.com/api/timedtext?v=video-1"
  });
  await flush();

  assert.equal(harness.subtitleArea.dataset.captionState, "error");
  assert.match(harness.subtitleArea.textContent, /429/);
});

test("keeps refresh pending until the requested subtitle build finishes", async () => {
  let finishBuild;
  const harness = createHarness({
    buildImplementation(video) {
      return new Promise((resolve) => {
        finishBuild = () =>
          resolve([
            { video_id: video, timestamp: 0, end_timestamp: 1, learn: "ready" }
          ]);
      });
    }
  });
  await flush();

  let refreshSettled = false;
  const refreshPromise = harness.SubSync.refresh().then(() => {
    refreshSettled = true;
  });
  await flush();

  harness.emit({ source: "SUBSYNC", type: "TRACKS", tracks: [{ lang: "en" }] });
  harness.emit({
    source: "SUBSYNC",
    type: "TIMEDTEXT_URL",
    url: "https://www.youtube.com/api/timedtext?v=video-1"
  });
  await flush();

  assert.equal(refreshSettled, false);
  finishBuild();
  await refreshPromise;
  assert.equal(refreshSettled, true);
});

test("finishes refresh with a visible error when caption metadata is unavailable", async () => {
  const harness = createHarness();
  await flush();

  let refreshSettled = false;
  const refreshPromise = harness.SubSync.refresh().then(() => {
    refreshSettled = true;
  });
  await flush();

  harness.emit({
    source: "SUBSYNC",
    type: "CAPTION_SOURCE_ERROR",
    code: "source-unavailable"
  });
  await refreshPromise;

  assert.equal(refreshSettled, true);
  assert.equal(harness.subtitleArea.dataset.captionState, "error");
  assert.match(harness.subtitleArea.textContent, /자막 정보를 찾지 못했습니다/);
});

test("rebuilds when a native track receives a refreshed signed URL", async () => {
  const harness = createHarness();
  await flush();

  harness.emit({
    source: "SUBSYNC",
    type: "TRACKS",
    tracks: [
      { lang: "en", baseUrl: "https://www.youtube.com/api/timedtext?v=video-1&lang=en&sig=en" },
      { lang: "ko", baseUrl: "https://www.youtube.com/api/timedtext?v=video-1&lang=ko&sig=old" }
    ]
  });
  harness.emit({
    source: "SUBSYNC",
    type: "TIMEDTEXT_URL",
    url: "https://www.youtube.com/api/timedtext?v=video-1&lang=en&sig=en"
  });
  await flush();
  assert.equal(harness.buildCalls.length, 1);

  harness.emit({
    source: "SUBSYNC",
    type: "TRACKS",
    tracks: [
      { lang: "en", baseUrl: "https://www.youtube.com/api/timedtext?v=video-1&lang=en&sig=en" },
      { lang: "ko", baseUrl: "https://www.youtube.com/api/timedtext?v=video-1&lang=ko&sig=fresh" }
    ]
  });
  await flush();

  assert.equal(harness.buildCalls.length, 2);
  assert.match(harness.buildCalls[1].options.tracks[1].baseUrl, /sig=fresh/);
});

test("routes caption builds through the page-context fetch bridge", async () => {
  const harness = createHarness({
    pageFetchResult(message) {
      return {
        ok: true,
        status: 200,
        body: JSON.stringify({
          events: [
            {
              tStartMs: 0,
              dDurationMs: 1000,
              segs: [{ utf8: message.url.includes("tlang=ko") ? "번역" : "Caption." }]
            }
          ]
        })
      };
    },
    buildImplementation: async (video, url, buildOptions) => {
      const learnResponse = await buildOptions.fetchCaption(url);
      const learnBody = JSON.parse(await learnResponse.text());
      const knownResponse = await buildOptions.fetchCaption(`${url}&tlang=ko`);
      const knownBody = JSON.parse(await knownResponse.text());
      return [{
        video_id: video,
        timestamp: 0,
        end_timestamp: 1,
        learn: learnBody.events[0].segs[0].utf8,
        known: knownBody.events[0].segs[0].utf8
      }];
    }
  });
  await flush();

  harness.emit({ source: "SUBSYNC", type: "TRACKS", tracks: [{ lang: "en" }] });
  harness.emit({
    source: "SUBSYNC",
    type: "TIMEDTEXT_URL",
    url: "https://www.youtube.com/api/timedtext?v=video-1&lang=en"
  });
  await flush();

  assert.equal(harness.pageFetchRequests.length, 2);
  assert.equal(harness.scriptSubtitleCalls.at(-1)[0].known, "번역");
});
