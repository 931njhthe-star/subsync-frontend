// 인증 서비스 (토큰 및 사용자 정보 저장/조회/회원가입)
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

    async getUser() {
      return new Promise((resolve) => {
        chrome.storage.local.get([USER_KEY], (res) => resolve(res[USER_KEY] || null));
      });
    },

    async isAuthenticated() {
      const token = await this.getToken();
      return !!token;
    },

    async signup(email, password, nickname) {
      const res = await SubSync.apiClient.request("/auth/signup", {
        method: "POST",
        body: JSON.stringify({ email, password, nickname })
      });
      if (res && res.access_token) {
        chrome.storage.local.set({
          [TOKEN_KEY]: res.access_token,
          [USER_KEY]: { id: res.user_id, email: res.email, nickname: res.nickname }
        });
      }
      return res;
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
      return new Promise((resolve) => {
        chrome.storage.local.remove([TOKEN_KEY, USER_KEY], () => {
          if (SubSync.layout && SubSync.layout.updateAuthUI) {
            SubSync.layout.updateAuthUI();
          }
          resolve();
        });
      });
    }
  };
})();
