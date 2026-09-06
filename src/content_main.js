// 프론트엔드 엔트리포인트 (설정 초기화, 화면 라이프사이클 조립 및 동기화)
(function () {
  const SubSync = (window.__SubSync = window.__SubSync || {});

  let currentVideoId = null;
  let subtitles = [];
  let workingUrl = null;
  let tracks = [];
  let syncTimer = null;
  let trackMetadataReady = false;
  let loadGeneration = 0;
  let nextRequestId = 0;
  let activeRequestId = 0;
  let acceptingCaptionMessages = false;
  let nextBuildId = 0;
  let buildInFlight = null;
  let lastBuildKey = null;
  let nextCaptionFetchId = 0;
  const pendingCaptionFetches = new Map();

  function cancelPendingCaptionFetches() {
    for (const pending of pendingCaptionFetches.values()) {
      pending.reject(new Error("caption request superseded"));
    }
    pendingCaptionFetches.clear();
  }

  function fetchCaptionInPage(url, videoId, requestId) {
    const fetchId = `${requestId}:${++nextCaptionFetchId}`;
    return new Promise((resolve, reject) => {
      pendingCaptionFetches.set(fetchId, { videoId, requestId, resolve, reject });
      window.postMessage(
        {
          source: "SUBSYNC_PAGE_FETCH_REQUEST",
          fetchId,
          videoId,
          requestId,
          url
        },
        "*"
      );
    });
  }

  function captionLanguageCode(url) {
    try {
      const parsed = new URL(url);
      return parsed.searchParams.get("tlang") || parsed.searchParams.get("lang") || "";
    } catch (_) {
      return "";
    }
  }

  function fetchCaptionThroughRelay(url, videoId, requestId) {
    if (
      typeof chrome === "undefined" ||
      !chrome.runtime ||
      typeof chrome.runtime.sendMessage !== "function"
    ) {
      return fetchCaptionInPage(url, videoId, requestId);
    }

    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          type: "FETCH_CAPTION",
          url,
          videoId,
          requestId,
          languageCode: captionLanguageCode(url)
        },
        (response) => {
          const runtimeError = chrome.runtime.lastError;
          if (runtimeError) {
            reject(new Error(runtimeError.message));
            return;
          }
          if (!response || !response.ok || !response.data) {
            reject(new Error((response && response.error) || "자막 relay 요청에 실패했습니다."));
            return;
          }
          const data = response.data;
          resolve({
            ok: Boolean(data.ok),
            status: Number(data.status) || 0,
            async text() {
              return typeof data.body === "string" ? data.body : "";
            }
          });
        }
      );
    });
  }

  function makeBuildKey(videoId, url, trackSnapshot) {
    return JSON.stringify({
      videoId,
      url,
      tracks: trackSnapshot.map((track) => ({
        lang: track.lang || "",
        kind: track.kind || "",
        baseUrl: track.baseUrl || ""
      }))
    });
  }

  function getCaptionStatusText(status) {
    if (!status) return "";
    if (status.state === "loading") return "자막 정보를 다시 불러오는 중...";
    if (status.state === "ready") return "자막 준비 완료 · 영상을 재생하세요.";
    if (status.state === "warning") {
      if (status.phase === "known" && status.code === "http" && status.httpStatus === 429) {
        return "한국어 자막 요청이 제한됐습니다 (HTTP 429). VPN 서버를 바꾸거나 잠시 후 새로고침하세요.";
      }
      if (status.phase === "known" && status.code === "empty") {
        return "영어 자막은 복구됐지만 YouTube가 한국어 자막에 빈 응답을 반환했습니다.";
      }
      if (status.phase === "known") {
        return "영어 자막은 복구됐지만 한국어 자막을 불러오지 못했습니다.";
      }
      return "일부 자막만 불러왔습니다.";
    }
    if (status.code === "http" && status.httpStatus === 429) {
      return "YouTube 자막 요청이 제한됐습니다 (HTTP 429). VPN 서버를 바꾸거나 잠시 후 새로고침하세요.";
    }
    if (status.code === "http") {
      return `YouTube 자막 요청에 실패했습니다 (HTTP ${status.httpStatus || "오류"}).`;
    }
    if (status.code === "empty") {
      return "YouTube가 빈 자막 응답을 반환했습니다. 새로고침해 다시 시도하세요.";
    }
    if (status.code === "parse" || status.code === "no-cues") {
      return "받은 자막 데이터를 읽을 수 없습니다. 새로고침해 다시 시도하세요.";
    }
    if (status.code === "source-unavailable") {
      return "현재 영상의 자막 정보를 찾지 못했습니다. YouTube 자막을 켠 뒤 새로고침해 다시 시도하세요.";
    }
    return "YouTube 자막 요청에 실패했습니다. 네트워크 상태를 확인한 뒤 새로고침하세요.";
  }

  function showCaptionStatus(status) {
    const subtitleArea =
      SubSync.layout && SubSync.layout.getSubtitleArea
        ? SubSync.layout.getSubtitleArea()
        : null;
    if (!subtitleArea) return;
    subtitleArea.innerHTML = "";
    subtitleArea.textContent = getCaptionStatusText(status);
    if (subtitleArea.dataset) {
      subtitleArea.dataset.captionState = status && status.state ? status.state : "";
    }
  }

  async function tryBuildSubtitles() {
    const videoId = SubSync.getVideoId();
    const url = workingUrl;
    if (!videoId || !url || !trackMetadataReady) return;

    const trackSnapshot = Array.isArray(tracks)
      ? tracks.map((track) => ({ ...(track || {}) }))
      : [];
    const buildKey = makeBuildKey(videoId, url, trackSnapshot);
    if (lastBuildKey === buildKey) return;
    if (buildInFlight && buildInFlight.key === buildKey) {
      return buildInFlight.promise;
    }

    const generation = loadGeneration;
    const requestId = activeRequestId;
    const buildId = ++nextBuildId;
    const promise = (async () => {
      let lastReportedStatus = null;
      try {
        const result = await SubSync.buildSubtitlesFromUrl(videoId, url, {
          tracks: trackSnapshot,
          learnLang: "en",
          knownLang: "ko",
          fetchCaption: (captionUrl) =>
            fetchCaptionThroughRelay(captionUrl, videoId, requestId),
          onStatus(status) {
            if (
              generation !== loadGeneration ||
              buildId !== nextBuildId ||
              videoId !== currentVideoId ||
              url !== workingUrl
            ) {
              return;
            }
            lastReportedStatus = status;
            showCaptionStatus(status);
          }
        });

        // 영상이 바뀌었거나 더 최신 metadata 빌드가 시작되면 이전 결과를 버린다.
        if (
          generation !== loadGeneration ||
          buildId !== nextBuildId ||
          videoId !== currentVideoId ||
          url !== workingUrl
        ) {
          return;
        }

        subtitles = Array.isArray(result) ? result : [];
        // 429·빈 본문·파싱 실패가 []로 내려온 경우 성공 캐시로 고정하지 않는다.
        // 이후 YouTube의 실제 timedtext 재요청이나 사용자의 refresh가 같은 URL로 재시도할 수 있다.
        if (subtitles.length) {
          lastBuildKey = buildKey;
        } else if (!lastReportedStatus) {
          showCaptionStatus({ state: "error", phase: "learn", code: "empty" });
        }
        if (SubSync.scriptPanel && SubSync.scriptPanel.setSubtitles) {
          SubSync.scriptPanel.setSubtitles(subtitles);
        }
      } catch (err) {
        console.error("[SubSync] 자막 빌드 실패:", err);
        if (
          generation === loadGeneration &&
          requestId === activeRequestId &&
          videoId === currentVideoId
        ) {
          showCaptionStatus({ state: "error", phase: "learn", code: "network" });
        }
      } finally {
        settleRefresh(requestId);
        if (buildInFlight && buildInFlight.id === buildId) {
          buildInFlight = null;
        }
      }
    })();

    buildInFlight = { id: buildId, key: buildKey, promise };
    return promise;
  }

  function startSync() {
    if (syncTimer) clearInterval(syncTimer);
    let watchSampleAt = null;
    syncTimer = setInterval(() => {
      const v = SubSync.player.getVideo();
      if (!v) return;

      const nowMs = Date.now();
      if (v.paused || v.ended) {
        watchSampleAt = null;
      } else if (watchSampleAt === null) {
        watchSampleAt = nowMs;
      } else if (nowMs - watchSampleAt >= 10000) {
        if (SubSync.logService && SubSync.logService.recordWatch) {
          SubSync.logService.recordWatch(Math.max(1, Math.round((nowMs - watchSampleAt) / 1000)));
        }
        watchSampleAt = nowMs;
      }

      if (!subtitles.length) return;

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
      SubSync.scriptPanel.highlightTime(curTime, {
        autoScroll: !v.paused && !v.ended
      });

      // AI 선제 질문 체크
      if (activeSub && activeSub.learn) {
        SubSync.tutorChat.triggerProactiveIfNeed(activeSub.learn);
      }
    }, 200);
  }

  function clearRenderedSubtitles() {
    if (SubSync.subtitleView && SubSync.subtitleView.clear) {
      SubSync.subtitleView.clear();
    }

    const subtitleArea =
      SubSync.layout && SubSync.layout.getSubtitleArea
        ? SubSync.layout.getSubtitleArea()
        : null;
    if (subtitleArea) {
      subtitleArea.innerHTML = "";
      subtitleArea.textContent = "";
      if (subtitleArea.dataset) subtitleArea.dataset.captionState = "";
    }

    if (SubSync.scriptPanel && SubSync.scriptPanel.setSubtitles) {
      SubSync.scriptPanel.setSubtitles([]);
    }
  }

  let refreshInFlight = null;
  let refreshCompletion = null;

  function settleRefresh(requestId) {
    if (!refreshCompletion || refreshCompletion.requestId !== requestId) return;
    const completion = refreshCompletion;
    refreshCompletion = null;
    completion.resolve();
  }

  async function refreshCurrentVideo() {
    if (refreshInFlight) return refreshInFlight;

    const requestId = nextRequestId + 1;
    const completion = new Promise((resolve) => {
      refreshCompletion = { requestId, resolve };
    });
    refreshInFlight = (async () => {
      const startedRequestId = await load({ forceRefresh: true });
      if (startedRequestId !== requestId) settleRefresh(requestId);
      return completion;
    })().finally(() => {
      refreshInFlight = null;
    });
    return refreshInFlight;
  }

  SubSync.refresh = refreshCurrentVideo;

  async function load(options = {}) {
    const forceRefresh = Boolean(options.forceRefresh);
    const videoId = SubSync.getVideoId();
    if (!videoId) return;
    if (videoId === currentVideoId && !forceRefresh) return;

    currentVideoId = videoId;
    const generation = ++loadGeneration;
    const requestId = ++nextRequestId;
    if (refreshCompletion && refreshCompletion.requestId !== requestId) {
      settleRefresh(refreshCompletion.requestId);
    }
    activeRequestId = requestId;
    acceptingCaptionMessages = false;
    cancelPendingCaptionFetches();
    nextBuildId += 1;
    buildInFlight = null;
    lastBuildKey = null;
    workingUrl = null;
    subtitles = [];
    tracks = [];
    trackMetadataReady = false;

    // 사용자 설정 초기화
    if (SubSync.settings && SubSync.settings.init) {
      await SubSync.settings.init();
    }
    if (SubSync.glassFilter && SubSync.glassFilter.init) {
      SubSync.glassFilter.init();
    }
    if (SubSync.theme && SubSync.theme.init) {
      SubSync.theme.init();
    }
    if (SubSync.font && SubSync.font.init) {
      SubSync.font.init();
    }

    // 느린 설정 초기화 도중 영상/refresh 세대가 바뀌면 이전 load를 중단한다.
    if (generation !== loadGeneration || videoId !== currentVideoId) return;

    await SubSync.layout.ensureRoot();
    if (SubSync.scriptPanel && SubSync.scriptPanel.ensureContainer) {
      SubSync.scriptPanel.ensureContainer();
    }
    clearRenderedSubtitles();
    showCaptionStatus({ state: "loading" });
    SubSync.tutorChat.init(SubSync.layout.getTutorArea());

    acceptingCaptionMessages = true;
    window.postMessage(
      {
        source: "SUBSYNC_REQUEST",
        videoId,
        requestId,
        forceRefresh
      },
      "*"
    );
    startSync();
    return requestId;
  }

  window.addEventListener("message", (e) => {
    if (e.source !== window || !e.data || e.data.source !== "SUBSYNC") return;
    if (e.data.type === "PAGE_FETCH_RESULT") {
      const pending = pendingCaptionFetches.get(e.data.fetchId);
      if (!pending) return;
      pendingCaptionFetches.delete(e.data.fetchId);
      if (
        pending.videoId !== e.data.videoId ||
        pending.requestId !== e.data.requestId
      ) {
        pending.reject(new Error("caption response provenance mismatch"));
        return;
      }
      pending.resolve({
        ok: Boolean(e.data.ok),
        status: Number(e.data.status) || 0,
        async text() {
          return typeof e.data.body === "string" ? e.data.body : "";
        }
      });
      return;
    }
    if (!acceptingCaptionMessages) return;
    if (e.data.videoId !== currentVideoId) return;
    if (e.data.requestId !== activeRequestId) return;
    if (e.data.type === "CAPTION_SOURCE_ERROR") {
      showCaptionStatus({
        state: "error",
        phase: "source",
        code: e.data.code || "source-unavailable"
      });
      settleRefresh(activeRequestId);
    } else if (e.data.type === "TRACKS") {
      tracks = Array.isArray(e.data.tracks) ? e.data.tracks : [];
      trackMetadataReady = true;
      if (workingUrl) tryBuildSubtitles();
    } else if (e.data.type === "TIMEDTEXT_URL") {
      if (typeof e.data.url !== "string" || !e.data.url) return;
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
