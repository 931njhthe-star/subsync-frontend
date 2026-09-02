// 실시간 행동 로그 전송 서비스
(function () {
  const SubSync = (window.__SubSync = window.__SubSync || {});

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
      this.sendEvent("word_click", { word, context: sentence });
    },

    recordWatch(durationSec) {
      this.sendEvent("watch_interval", { duration_sec: durationSec });
    }
  };
})();
