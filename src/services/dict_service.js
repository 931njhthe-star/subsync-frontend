// 사전 조회 서비스 (sessionStorage 1차 캐시 → 백엔드 호출)
(function () {
  const SubSync = (window.__SubSync = window.__SubSync || {});

  SubSync.dictService = {
    async getHoverMeaning(word) {
      const cleanWord = word.toLowerCase().trim();
      const cacheKey = `subsync_hover_${cleanWord}`;
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const res = await SubSync.apiClient.request(`/dict/hover?word=${encodeURIComponent(cleanWord)}`);
      sessionStorage.setItem(cacheKey, JSON.stringify(res));
      return res;
    },

    async getDetailMeaning(word, sentence) {
      const cleanWord = word.toLowerCase().trim();
      const query = `/dict/detail?word=${encodeURIComponent(cleanWord)}&context=${encodeURIComponent(sentence || "")}`;
      return await SubSync.apiClient.request(query);
    },

    async saveWord(word, meaning, sentence) {
      const videoId = SubSync.getVideoId ? SubSync.getVideoId() : "";
      const timestamp = SubSync.player.getCurrentTime();
      const payload = {
        word,
        meaning,
        video_id: videoId,
        timestamp,
        context_sentence: sentence
      };

      try {
        const response = await SubSync.apiClient.request("/words/save", {
          method: "POST",
          body: JSON.stringify(payload)
        });
        if (SubSync.learningHistory) {
          await SubSync.learningHistory.saveWord({
            ...payload,
            ...response,
            local_only: false
          });
        }
        return response;
      } catch (error) {
        if (!SubSync.learningHistory) throw error;
        return await SubSync.learningHistory.saveWord({
          ...payload,
          local_only: true
        });
      }
    }
  };
})();
