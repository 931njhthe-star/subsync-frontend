// MV3 서비스 워커: YouTube 자막 요청의 임시 PO token relay
importScripts("core/caption_requests.js");

const {
  applyCapturedCaptionRequest,
  captionRequestCacheKey,
  captionRequestCacheKeys,
  captionRequestFromUrl,
  isFreshCaptionRequest
} = globalThis.SubSyncCaptionRequests;

const YOUTUBE_HOSTS = new Set([
  "www.youtube.com",
  "m.youtube.com",
  "www.youtube-nocookie.com"
]);
const captionRequestMemory = new Map();

function rememberCaptionRequest(tabId, rawUrl) {
  const numericTabId = Number(tabId);
  if (!Number.isInteger(numericTabId) || numericTabId < 0) return;

  const request = captionRequestFromUrl(rawUrl);
  if (!request) return;

  const keys = [
    captionRequestCacheKey(numericTabId, request.videoId, request.languageCode),
    captionRequestCacheKey(numericTabId, request.videoId)
  ];
  const entries = {};
  for (const key of keys) {
    captionRequestMemory.set(key, request);
    entries[key] = request;
  }

  const sessionStorage = chrome.storage && chrome.storage.session;
  if (sessionStorage && typeof sessionStorage.set === "function") {
    try {
      const result = sessionStorage.set(entries);
      if (result && typeof result.catch === "function") result.catch(() => {});
    } catch (_) {}
  }
}

async function getCapturedCaptionRequest(tabId, videoId, languageCode = "") {
  const numericTabId = Number(tabId);
  const normalizedVideoId = String(videoId || "");
  if (
    !Number.isInteger(numericTabId) ||
    numericTabId < 0 ||
    !normalizedVideoId
  ) {
    return null;
  }

  const keys = captionRequestCacheKeys(
    numericTabId,
    normalizedVideoId,
    languageCode
  );
  const now = Date.now();
  for (const key of keys) {
    const cached = captionRequestMemory.get(key);
    if (isFreshCaptionRequest(cached, now)) return cached;
  }

  const sessionStorage = chrome.storage && chrome.storage.session;
  if (!sessionStorage || typeof sessionStorage.get !== "function") return null;
  try {
    const stored = await sessionStorage.get(keys);
    for (const key of keys) {
      const cached = stored && stored[key];
      if (isFreshCaptionRequest(cached, now)) {
        captionRequestMemory.set(key, cached);
        return cached;
      }
    }
  } catch (_) {}
  return null;
}

function validateYouTubeCaptionUrl(rawUrl) {
  const url = new URL(rawUrl);
  if (!YOUTUBE_HOSTS.has(url.hostname) || url.pathname !== "/api/timedtext") {
    throw new Error("허용되지 않은 유튜브 자막 요청입니다.");
  }
  return url;
}

async function fetchCaption(rawUrl, tabId, videoId, languageCode) {
  const targetUrl = validateYouTubeCaptionUrl(rawUrl);
  const targetVideoId = targetUrl.searchParams.get("v") || "";
  if (videoId && targetVideoId && String(videoId) !== targetVideoId) {
    throw new Error("다른 영상의 자막 요청은 처리하지 않습니다.");
  }

  const captured = await getCapturedCaptionRequest(
    tabId,
    targetVideoId || videoId,
    languageCode
  );
  const effectiveUrl = new URL(
    applyCapturedCaptionRequest(targetUrl.toString(), captured && captured.url)
  );
  effectiveUrl.searchParams.set("fmt", "json3");

  const response = await fetch(effectiveUrl.toString(), {
    credentials: "include"
  });
  const body = await response.text();
  return {
    ok: response.ok,
    status: Number(response.status) || 0,
    contentType: response.headers && response.headers.get
      ? response.headers.get("content-type") || ""
      : "",
    body
  };
}

if (chrome.webRequest && chrome.webRequest.onBeforeRequest) {
  chrome.webRequest.onBeforeRequest.addListener(
    (details) => {
      if (details && details.method === "GET") {
        rememberCaptionRequest(details.tabId, details.url);
      }
    },
    {
      urls: [
        "https://www.youtube.com/api/timedtext*",
        "https://m.youtube.com/api/timedtext*",
        "https://www.youtube-nocookie.com/api/timedtext*"
      ]
    }
  );
}

if (chrome.tabs && chrome.tabs.onRemoved) {
  chrome.tabs.onRemoved.addListener((tabId) => {
    const prefix = `subsync:caption-request:${String(tabId)}:`;
    for (const key of captionRequestMemory.keys()) {
      if (key.startsWith(prefix)) captionRequestMemory.delete(key);
    }
  });
}

if (chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || !message.type) return false;

    if (message.type === "GET_CAPTURED_CAPTION") {
      getCapturedCaptionRequest(
        sender && sender.tab && sender.tab.id,
        message.videoId,
        message.languageCode
      )
        .then((data) => sendResponse({ ok: true, data }))
        .catch((error) => sendResponse({ ok: false, error: error.message }));
      return true;
    }

    if (message.type === "FETCH_CAPTION") {
      fetchCaption(
        message.url,
        sender && sender.tab && sender.tab.id,
        message.videoId,
        message.languageCode
      )
        .then((data) => sendResponse({ ok: true, data }))
        .catch((error) => sendResponse({ ok: false, error: error.message }));
      return true;
    }

    return false;
  });
}
