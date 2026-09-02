// YouTube pot 우회 및 timedtext URL 가로채기 엔진 (MAIN 월드)
(function () {
  const TAG = "[SubSync/inject]";
  let capturedUrl = null;
  let savedTrack = null;
  let stateSaved = false;

  function getPlayer() {
    const p = document.getElementById("movie_player");
    if (
      p &&
      typeof p.getOption === "function" &&
      typeof p.setOption === "function" &&
      typeof p.loadModule === "function"
    ) {
      return p;
    }
    return null;
  }

  function looksLikeTimedText(url) {
    return typeof url === "string" && url.indexOf("/api/timedtext") !== -1;
  }

  function restoreCaptionState() {
    const player = getPlayer();
    if (!player) return;
    try {
      if (savedTrack && Object.keys(savedTrack).length) {
        player.setOption("captions", "track", savedTrack);
      } else {
        player.setOption("captions", "track", {});
        try { player.unloadModule("captions"); } catch (_) {}
      }
    } catch (_) {}
  }

  function postCaptured(url) {
    if (!url || capturedUrl) return;
    capturedUrl = url;
    window.postMessage({ source: "SUBSYNC", type: "TIMEDTEXT_URL", url }, "*");
    console.log(TAG, "timedtext URL 가로챔");
    setTimeout(restoreCaptionState, 600);
  }

  const origFetch = window.fetch;
  window.fetch = function (...args) {
    let url = "";
    try {
      url = typeof args[0] === "string" ? args[0] : args[0] && args[0].url;
    } catch (_) {}
    const p = origFetch.apply(this, args);
    if (looksLikeTimedText(url)) postCaptured(url);
    return p;
  };

  const origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    if (looksLikeTimedText(url)) {
      try { postCaptured(url); } catch (_) {}
    }
    return origOpen.apply(this, arguments);
  };

  function announceTracks() {
    try {
      const pr = window.ytInitialPlayerResponse;
      const renderer =
        ((pr || {}).captions || {}).playerCaptionsTracklistRenderer || {};
      const tracks = renderer.captionTracks || [];
      const translations = renderer.translationLanguages || [];
      const nameOf = (n) =>
        (n && (n.simpleText || (n.runs && n.runs[0] && n.runs[0].text))) || "";
      window.postMessage(
        {
          source: "SUBSYNC",
          type: "TRACKS",
          tracks: tracks.map((t) => ({
            lang: t.languageCode,
            kind: t.kind || "",
          })),
          translations: translations.map((t) => ({
            code: t.languageCode,
            name: nameOf(t.languageName),
          })),
        },
        "*"
      );
    } catch (_) {}
  }

  function tryEnableCaptions() {
    if (capturedUrl) return true;
    const player = getPlayer();
    if (!player) return false;
    try {
      if (!stateSaved) {
        try {
          savedTrack = player.getOption("captions", "track") || {};
        } catch (_) {
          savedTrack = {};
        }
        stateSaved = true;
      }

      player.loadModule("captions");
      let list = [];
      try {
        list = player.getOption("captions", "tracklist") || [];
      } catch (_) {
        list = [];
      }
      if (list && list.length) {
        const en =
          list.find((t) => (t.languageCode || "").startsWith("en")) || list[0];
        player.setOption("captions", "track", en);
        try { player.setOption("captions", "reload", true); } catch (_) {}
        return true;
      }
    } catch (_) {}
    return false;
  }

  let attempts = 0;
  let timer = null;

  function startPolling() {
    attempts = 0;
    if (timer) clearInterval(timer);
    timer = setInterval(() => {
      attempts++;
      announceTracks();
      tryEnableCaptions();
      if (capturedUrl || attempts > 60) clearInterval(timer);
    }, 500);
  }

  document.addEventListener("yt-navigate-finish", () => {
    capturedUrl = null;
    savedTrack = null;
    stateSaved = false;
    setTimeout(startPolling, 500);
  });

  startPolling();

  window.addEventListener("message", (e) => {
    if (e.source !== window || !e.data || e.data.source !== "SUBSYNC_REQUEST") return;
    announceTracks();
    if (capturedUrl) {
      window.postMessage({ source: "SUBSYNC", type: "TIMEDTEXT_URL", url: capturedUrl }, "*");
    } else {
      tryEnableCaptions();
    }
  });
})();
