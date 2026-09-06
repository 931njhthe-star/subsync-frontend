// 실시간 행동 로그 전송 서비스
(function () {
  const SubSync = (window.__SubSync = window.__SubSync || {});

  function currentVideoTitle() {
    if (typeof document === "undefined") return "";
    const selectors = [
      "h1.ytd-watch-metadata yt-formatted-string",
      "h1.title yt-formatted-string",
      "meta[property=\"og:title\"]"
    ];
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      const value = element?.content || element?.textContent;
      if (value && String(value).trim()) return String(value).trim();
    }
    return String(document.title || "")
      .replace(/\s*-\s*YouTube\s*$/i, "")
      .trim();
  }

  SubSync.logService = {
    async sendEvent(eventType, payload = {}) {
      const videoId = SubSync.getVideoId ? SubSync.getVideoId() : "";
      const timestamp = SubSync.player.getCurrentTime();
      try {
        await SubSync.apiClient.request("/logs/event", {
          method: "POST",
          body: JSON.stringify({
            event_type: eventType,
            video_id: videoId,
            timestamp,
            payload
          })
        });
      } catch (_) {
        // 로깅 실패는 사용자 흐름을 방해하지 않음
      }
    },

    recordClick(word, sentence) {
      if (SubSync.learningHistory && SubSync.player) {
        SubSync.learningHistory.recordWordClick(word, sentence, {
          video_id: SubSync.getVideoId ? SubSync.getVideoId() : "",
          timestamp: SubSync.player.getCurrentTime()
        });
      }
      this.sendEvent("word_click", { word, context: sentence });
    },

    recordWatch(durationSec) {
      const title = currentVideoTitle();
      if (SubSync.learningHistory && SubSync.getVideoId) {
        SubSync.learningHistory.recordWatch(
          SubSync.getVideoId(),
          durationSec,
          { timestamp: SubSync.player.getCurrentTime(), title }
        );
      }
      this.sendEvent("watch_interval", { duration_sec: durationSec });
    }
  };
})();
