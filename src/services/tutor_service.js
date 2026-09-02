// Video Tutor API 서비스 (질의응답, 선제 질문, 피드백)
(function () {
  const SubSync = (window.__SubSync = window.__SubSync || {});

  SubSync.tutorService = {
    async ask(userMessage, recentSubtitles) {
      const videoId = SubSync.getVideoId ? SubSync.getVideoId() : "";
      const timestamp = SubSync.player.getCurrentTime();
      return await SubSync.apiClient.request("/tutor/ask", {
        method: "POST",
        body: JSON.stringify({
          video_id: videoId,
          timestamp,
          user_message: userMessage,
          recent_subtitles: recentSubtitles || []
        })
      });
    },

    async checkProactive(currentSubtitleEn) {
      const videoId = SubSync.getVideoId ? SubSync.getVideoId() : "";
      const timestamp = SubSync.player.getCurrentTime();
      return await SubSync.apiClient.request("/tutor/proactive", {
        method: "POST",
        body: JSON.stringify({
          video_id: videoId,
          current_timestamp: timestamp,
          current_subtitle_en: currentSubtitleEn
        })
      });
    },

    async sendFeedback(messageId, rating, reason) {
      return await SubSync.apiClient.request("/tutor/feedback", {
        method: "POST",
        body: JSON.stringify({
          message_id: messageId,
          rating,
          reason
        })
      });
    }
  };
})();
