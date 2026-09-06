const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const filename = path.join(__dirname, "inject.js");
const source = fs.readFileSync(filename, "utf8");

function createHarness(playerResponse = {}) {
  const listeners = new Map();
  const documentListeners = new Map();
  const messages = [];
  const playerCalls = [];
  const intervalCallbacks = [];
  const timeoutCallbacks = [];

  const player = {
    getOption(...args) {
      playerCalls.push(["getOption", ...args]);
      return {};
    },
    setOption(...args) {
      playerCalls.push(["setOption", ...args]);
    },
    loadModule(...args) {
      playerCalls.push(["loadModule", ...args]);
    },
    unloadModule(...args) {
      playerCalls.push(["unloadModule", ...args]);
    }
  };

  function FakeXMLHttpRequest() {}
  FakeXMLHttpRequest.prototype.open = function open() {
    return undefined;
  };

  const window = {
    ytInitialPlayerResponse: playerResponse,
    location: { href: "https://www.youtube.com/watch?v=video-1" },
    fetch() {
      return Promise.resolve({
        ok: true,
        status: 200,
        async text() {
          return JSON.stringify({ events: [] });
        }
      });
    },
    addEventListener(type, handler) {
      listeners.set(type, handler);
    },
    postMessage(message) {
      messages.push(message);
    }
  };
  const document = {
    getElementById(id) {
      return id === "movie_player" ? player : null;
    },
    addEventListener(type, handler) {
      documentListeners.set(type, handler);
    }
  };
  const context = {
    console: { log() {}, warn() {}, error() {} },
    document,
    window,
    URL,
    XMLHttpRequest: FakeXMLHttpRequest,
    setInterval(callback) {
      intervalCallbacks.push(callback);
      return intervalCallbacks.length;
    },
    clearInterval() {},
    setTimeout(callback) {
      timeoutCallbacks.push(callback);
      return timeoutCallbacks.length;
    },
    clearTimeout() {}
  };

  vm.runInNewContext(source, context, { filename });

  return {
    window,
    messages,
    playerCalls,
    emitRequest(request = {}) {
      const handler = listeners.get("message");
      assert.ok(handler, "inject.js must register a window message listener");
      handler({ source: window, data: { source: "SUBSYNC_REQUEST", ...request } });
    },
    requestPageFetch(request = {}) {
      const handler = listeners.get("message");
      assert.ok(handler, "inject.js must register a window message listener");
      handler({ source: window, data: { source: "SUBSYNC_PAGE_FETCH_REQUEST", ...request } });
    },
    runPolling(times = 1) {
      for (let index = 0; index < times; index++) {
        for (const callback of intervalCallbacks) callback();
      }
    },
    runTimeouts() {
      while (timeoutCallbacks.length) timeoutCallbacks.shift()();
    },
    navigate() {
      const handler = documentListeners.get("yt-navigate-finish");
      assert.ok(handler, "inject.js must register yt-navigate-finish");
      handler();
    },
    setVideo(videoId, nextPlayerResponse) {
      window.location.href = `https://www.youtube.com/watch?v=${videoId}`;
      window.ytInitialPlayerResponse = nextPlayerResponse;
    }
  };
}

function captionResponse(videoId = "video-1") {
  return {
    captions: {
      playerCaptionsTracklistRenderer: {
        captionTracks: [
          {
            languageCode: "en",
            kind: "",
            baseUrl: `https://www.youtube.com/api/timedtext?lang=en&v=${videoId}`
          },
          {
            languageCode: "ko",
            kind: "",
            baseUrl: `https://www.youtube.com/api/timedtext?lang=ko&v=${videoId}`
          }
        ],
        translationLanguages: []
      }
    }
  };
}

test("never mutates or unloads YouTube's native captions module", () => {
  const harness = createHarness(captionResponse());

  harness.emitRequest();
  harness.runPolling();
  harness.runTimeouts();

  assert.deepEqual(harness.playerCalls, []);
});

test("uses an existing caption track URL without forcing the player to load captions", () => {
  const harness = createHarness(captionResponse());

  harness.emitRequest();

  const types = harness.messages.map((message) => message.type);
  assert.ok(types.includes("TRACKS"));
  assert.ok(types.includes("TIMEDTEXT_URL"));
  assert.equal(
    harness.messages.find((message) => message.type === "TIMEDTEXT_URL").url,
    "https://www.youtube.com/api/timedtext?lang=en&v=video-1"
  );
  assert.deepEqual(harness.playerCalls, []);
});

test("passively captures a timedtext request made by YouTube", async () => {
  const harness = createHarness();
  const url = "https://www.youtube.com/api/timedtext?lang=en&v=video-2";

  await harness.window.fetch(url);

  assert.deepEqual(
    harness.messages
      .filter((message) => message.type === "TIMEDTEXT_URL")
      .map((message) => ({
        source: String(message.source),
        type: String(message.type),
        url: String(message.url)
      })),
    [{ source: "SUBSYNC", type: "TIMEDTEXT_URL", url }]
  );
  assert.deepEqual(harness.playerCalls, []);
});

test("serves a caption request through the page fetch bridge without touching the player", async () => {
  const harness = createHarness();
  harness.requestPageFetch({
    fetchId: "1:1",
    videoId: "video-1",
    requestId: 1,
    url: "https://www.youtube.com/api/timedtext?lang=en&v=video-1"
  });
  await new Promise((resolve) => setImmediate(resolve));

  const result = harness.messages.find((message) => message.type === "PAGE_FETCH_RESULT");
  assert.equal(result.videoId, "video-1");
  assert.equal(result.requestId, 1);
  assert.equal(result.ok, true);
  assert.match(result.body, /events/);
  assert.deepEqual(harness.playerCalls, []);
});

test("refresh after SPA navigation returns only caption data for the requested video", () => {
  const harness = createHarness(captionResponse("video-1"));
  harness.emitRequest({ videoId: "video-1", requestId: 1 });

  harness.setVideo("video-2", captionResponse("video-2"));
  harness.navigate();
  harness.runTimeouts();
  harness.emitRequest({
    videoId: "video-2",
    requestId: 2,
    forceRefresh: true
  });

  const refreshMessages = harness.messages.filter(
    (message) => message.requestId === 2
  );
  assert.ok(refreshMessages.length >= 2);
  assert.ok(refreshMessages.every((message) => message.videoId === "video-2"));
  assert.ok(
    refreshMessages
      .filter((message) => message.type === "TIMEDTEXT_URL")
      .every((message) => new URL(message.url).searchParams.get("v") === "video-2")
  );
});

test("reports when current-video caption metadata cannot be found", () => {
  const harness = createHarness();
  harness.emitRequest({ videoId: "video-1", requestId: 9, forceRefresh: true });
  harness.runPolling(62);

  const failure = harness.messages.find(
    (message) => message.type === "CAPTION_SOURCE_ERROR"
  );
  assert.equal(failure.videoId, "video-1");
  assert.equal(failure.requestId, 9);
  assert.equal(failure.code, "source-unavailable");
});
