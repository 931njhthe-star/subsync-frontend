// 인증 서비스 (토큰 저장/조회 및 상태 확인)
(function () {
  const SubSync = (window.__SubSync = window.__SubSync || {});

  const TOKEN_KEY = "subsync_token";
  const USER_KEY = "subsync_user";

  SubSync.authService = {
    async getToken() {
      return new Promise((resolve) => {
        chrome.storage.local.get([TOKEN_KEY], (res) => resolve(res[TOKEN_KEY] || null));
      });
    },

    async isAuthenticated() {
      const token = await this.getToken();
      return !!token;
    },

    async login(email, password) {
      const res = await SubSync.apiClient.request("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      if (res && res.access_token) {
        chrome.storage.local.set({
          [TOKEN_KEY]: res.access_token,
          [USER_KEY]: { id: res.user_id, email: res.email, nickname: res.nickname }
        });
      }
      return res;
    },

    async logout() {
      chrome.storage.local.remove([TOKEN_KEY, USER_KEY]);
    }
  };
})();
