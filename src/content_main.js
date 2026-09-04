// 프론트엔드 엔트리포인트 (설정 초기화, 화면 라이프사이클 조립 및 동기화)
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

      // 독립 스크립트 패널에 자막 데이터 전달
      if (SubSync.scriptPanel && SubSync.scriptPanel.setSubtitles) {
        SubSync.scriptPanel.setSubtitles(subtitles);
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

      // 현재 재생 시간에 해당하는 문장 검색
      for (let i = 0; i < subtitles.length; i++) {
        const sub = subtitles[i];
        const endTime = sub.end_timestamp || (subtitles[i + 1] ? subtitles[i + 1].timestamp : sub.timestamp + 5.0);
        if (curTime >= sub.timestamp && curTime <= endTime) {
          activeSub = sub;
          break;
        } else if (sub.timestamp <= curTime) {
          activeSub = sub;
        }
      }

      // 이중자막 렌더링 (영상 위 오버레이 + 사이드바)
      if (SubSync.settings && SubSync.settings.get("subsyncEnabled") && SubSync.settings.get("dualSubtitle")) {
        SubSync.subtitleView.render(SubSync.layout.getSubtitleArea(), activeSub);
      } else {
        SubSync.subtitleView.clear();
        const subArea = SubSync.layout.getSubtitleArea();
        if (subArea) subArea.innerHTML = "";
      }

      // 스크립트 위치 하이라이트
      SubSync.scriptPanel.highlightTime(curTime);

      // AI 선제 질문 체크
      if (activeSub && activeSub.learn) {
        SubSync.tutorChat.triggerProactiveIfNeed(activeSub.learn);
      }
    }, 200);
  }

  async function load() {
    const videoId = SubSync.getVideoId();
    if (!videoId) return;
    if (videoId === currentVideoId) return;

    currentVideoId = videoId;
    workingUrl = null;
    subtitles = [];

    // 사용자 설정 초기화
    if (SubSync.settings && SubSync.settings.init) {
      await SubSync.settings.init();
    }

    await SubSync.layout.ensureRoot();
    if (SubSync.scriptPanel && SubSync.scriptPanel.ensureContainer) {
      SubSync.scriptPanel.ensureContainer();
    }
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
