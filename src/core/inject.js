// YouTube timedtext URL과 track metadata를 수동 조작 없이 관찰하는 엔진 (MAIN 월드)
(function () {
  const TAG = "[SubSync/inject]";
  const capturedUrls = new Map();
  let activeRequest = null;

  function looksLikeTimedText(url) {
    return typeof url === "string" && url.indexOf("/api/timedtext") !== -1;
  }

  function getCurrentVideoId() {
    try {
      const pageUrl = new URL(window.location.href);
      if (pageUrl.pathname === "/watch") return pageUrl.searchParams.get("v");
      const shorts = pageUrl.pathname.match(/^\/shorts\/([\w-]+)/);
      return shorts ? shorts[1] : null;
    } catch (_) {
      return null;
    }
  }

  function getTimedTextVideoId(url) {
    try {
      return new URL(url, window.location.href).searchParams.get("v");
    } catch (_) {
      return null;
    }
  }

  function sendCapturedUrl(videoId, requestId) {
    const url = videoId ? capturedUrls.get(videoId) : null;
    if (!videoId || !url) return false;
    window.postMessage(
      {
        source: "SUBSYNC",
        type: "TIMEDTEXT_URL",
        videoId,
        requestId: requestId || null,
        url
      },
      "*"
    );
    return true;
  }

  function postCaptured(url, options = {}) {
    if (!looksLikeTimedText(url)) return false;

    const urlVideoId = getTimedTextVideoId(url);
    const videoId = urlVideoId || options.videoId || getCurrentVideoId();
    if (!videoId) return false;
    if (options.videoId && urlVideoId && options.videoId !== urlVideoId) {
      return false;
    }

    const changed = capturedUrls.get(videoId) !== url;
    capturedUrls.set(videoId, url);
    if (!changed && !options.forceNotify) return false;

    const requestId =
      options.requestId ||
      (activeRequest && activeRequest.videoId === videoId
        ? activeRequest.requestId
        : null);
    sendCapturedUrl(videoId, requestId);
    if (changed) console.log(TAG, "현재 영상 timedtext URL 관찰");
    return true;
  }

  const origFetch = window.fetch;

  function sendPageFetchResult(request, result) {
    window.postMessage(
      {
        source: "SUBSYNC",
        type: "PAGE_FETCH_RESULT",
        fetchId: request.fetchId,
        videoId: request.videoId,
        requestId: request.requestId,
        ok: Boolean(result.ok),
        status: Number(result.status) || 0,
        body: typeof result.body === "string" ? result.body : ""
      },
      "*"
    );
  }

  function fetchCaptionInPage(request) {
    const url = request && request.url;
    const videoId = request && request.videoId;
    const urlVideoId = getTimedTextVideoId(url);
    if (
      !request ||
      !request.fetchId ||
      !request.requestId ||
      !videoId ||
      !looksLikeTimedText(url) ||
      (urlVideoId && urlVideoId !== videoId)
    ) {
      return;
    }

    if (typeof origFetch !== "function") {
      sendPageFetchResult(request, { ok: false, status: 0, body: "" });
      return;
    }

    Promise.resolve()
      .then(() => origFetch.call(window, url, { credentials: "include" }))
      .then((response) =>
        response
          .text()
          .then((body) =>
            sendPageFetchResult(request, {
              ok: response.ok,
              status: response.status,
              body
            })
          )
      )
      .catch(() => sendPageFetchResult(request, { ok: false, status: 0, body: "" }));
  }

  window.fetch = function (...args) {
    let url = "";
    try {
      url = typeof args[0] === "string" ? args[0] : args[0] && args[0].url;
    } catch (_) {}
    const result = origFetch.apply(this, args);
    if (looksLikeTimedText(url)) postCaptured(url, { forceNotify: true });
    return result;
  };

  const origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    if (looksLikeTimedText(url)) {
      try {
        postCaptured(url, { forceNotify: true });
      } catch (_) {}
    }
    return origOpen.apply(this, arguments);
  };

  function getResponseVideoId(playerResponse, captionTracks) {
    const responseVideoId =
      playerResponse && playerResponse.videoDetails && playerResponse.videoDetails.videoId;
    if (responseVideoId) return responseVideoId;
    const firstUrl = captionTracks && captionTracks[0] && captionTracks[0].baseUrl;
    return getTimedTextVideoId(firstUrl);
  }

  function announceTracks(request = {}) {
    try {
      const playerResponse = window.ytInitialPlayerResponse;
      const renderer =
        ((playerResponse || {}).captions || {}).playerCaptionsTracklistRenderer || {};
      const captionTracks = renderer.captionTracks || [];
      const translations = renderer.translationLanguages || [];
      const requestedVideoId = request.videoId || getCurrentVideoId();
      const responseVideoId =
        getResponseVideoId(playerResponse, captionTracks) || requestedVideoId;

      // SPA 전환 중 남아 있는 이전 player response는 현재 영상 데이터로 사용하지 않는다.
      if (
        requestedVideoId &&
        responseVideoId &&
        requestedVideoId !== responseVideoId
      ) {
        return false;
      }

      const videoId = responseVideoId || requestedVideoId;
      if (!videoId) return false;

      const nameOf = (name) =>
        (name && (name.simpleText || (name.runs && name.runs[0] && name.runs[0].text))) || "";
      const tracks = captionTracks.map((track) => ({
        lang: track.languageCode,
        kind: track.kind || "",
        baseUrl: track.baseUrl || ""
      }));

      window.postMessage(
        {
          source: "SUBSYNC",
          type: "TRACKS",
          videoId,
          requestId: request.requestId || null,
          tracks,
          translations: translations.map((translation) => ({
            code: translation.languageCode,
            name: nameOf(translation.languageName)
          }))
        },
        "*"
      );

      const preferredTrack =
        captionTracks.find((track) => (track.languageCode || "").startsWith("en")) ||
        captionTracks[0];
      return postCaptured(preferredTrack && preferredTrack.baseUrl, {
        videoId,
        requestId: request.requestId,
        forceNotify: Boolean(request.requestId)
      });
    } catch (_) {
      return false;
    }
  }

  let attempts = 0;
  let timer = null;
  let pollingStopped = false;

  function reportSourceUnavailable() {
    if (!activeRequest || !activeRequest.videoId) return;
    window.postMessage(
      {
        source: "SUBSYNC",
        type: "CAPTION_SOURCE_ERROR",
        videoId: activeRequest.videoId,
        requestId: activeRequest.requestId,
        code: "source-unavailable"
      },
      "*"
    );
  }

  function startPolling() {
    attempts = 0;
    pollingStopped = false;
    if (timer) clearInterval(timer);
    announceTracks(activeRequest || {});
    timer = setInterval(() => {
      if (pollingStopped) return;
      attempts++;
      const sent = announceTracks(activeRequest || {});
      if (sent || attempts > 60) {
        pollingStopped = true;
        clearInterval(timer);
        if (!sent && attempts > 60) reportSourceUnavailable();
      }
    }, 500);
  }

  document.addEventListener("yt-navigate-finish", () => {
    activeRequest = null;
    setTimeout(startPolling, 500);
  });

  startPolling();

  window.addEventListener("message", (event) => {
    if (event.source === window && event.data && event.data.source === "SUBSYNC_PAGE_FETCH_REQUEST") {
      fetchCaptionInPage(event.data);
      return;
    }
    if (
      event.source !== window ||
      !event.data ||
      event.data.source !== "SUBSYNC_REQUEST"
    ) {
      return;
    }

    const videoId = event.data.videoId || getCurrentVideoId();
    activeRequest = {
      videoId,
      requestId: event.data.requestId || null
    };
    if (event.data.forceRefresh && videoId) capturedUrls.delete(videoId);

    const capturedFromTrack = announceTracks(activeRequest);
    if (!capturedFromTrack) sendCapturedUrl(videoId, activeRequest.requestId);
    if (!capturedFromTrack) startPolling();
  });
})();
