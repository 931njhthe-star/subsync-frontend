// 프론트엔드 엔트리포인트 (컴포넌트 초기화 및 라이프사이클 조립)
(function () {
  const SubSync = (window.__SubSync = window.__SubSync || {});

  let currentVideoId = null;
  let subtitles = [];
  let workingUrl = null;
  let tracks = [];
  let syncTimer = null;

  async function tryBuildSubtitles() {
    const videoId = SubSync.getVideoId();
    if (!videoId || !workingUrl) return;

    try {
      subtitles = await SubSync.buildSubtitlesFromUrl(videoId, workingUrl, {
        tracks,
        learnLang: "en",
        knownLang: "ko"
      });

      const scriptArea = SubSync.layout.getScriptArea();
      const toggleBtn = document.getElementById("subsync-toggle-script-btn");
      if (scriptArea && toggleBtn) {
        SubSync.scriptPanel.init(toggleBtn, scriptArea, subtitles);
      }
    } catch (err) {
      console.error("[SubSync] 자막 빌드 실패:", err);
    }
  }

  function startSync() {
    if (syncTimer) clearInterval(syncTimer);
    syncTimer = setInterval(() => {
      const v = SubSync.player.getVideo();
      if (!v || !subtitles.length) return;

      const curTime = v.currentTime;
      let activeSub = null;
      for (let i = 0; i < subtitles.length; i++) {
        if (subtitles[i].timestamp <= curTime) {
          activeSub = subtitles[i];
        } else {
          break;
        }
      }

      SubSync.subtitleView.render(SubSync.layout.getSubtitleArea(), activeSub);
      SubSync.scriptPanel.highlightTime(curTime);
    }, 250);
  }

  function load() {
    const videoId = SubSync.getVideoId();
    if (!videoId) return;
    if (videoId === currentVideoId) return;

    currentVideoId = videoId;
    workingUrl = null;
    subtitles = [];

    SubSync.layout.ensureRoot();
    SubSync.tutorChat.init(SubSync.layout.getTutorArea());

    window.postMessage({ source: "SUBSYNC_REQUEST" }, "*");
    startSync();
  }

  window.addEventListener("message", (e) => {
    if (e.source !== window || !e.data || e.data.source !== "SUBSYNC") return;
    if (e.data.type === "TRACKS") {
      tracks = e.data.tracks || [];
    } else if (e.data.type === "TIMEDTEXT_URL") {
      workingUrl = e.data.url;
      tryBuildSubtitles();
    }
  });

  document.addEventListener("yt-navigate-finish", () => setTimeout(load, 500));
  setInterval(() => {
    if (SubSync.getVideoId() !== currentVideoId) load();
  }, 1000);

  load();
})();
