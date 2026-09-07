// Google OAuth 세션 서비스
(function () {
  const SubSync = (window.__SubSync = window.__SubSync || {});

  const TOKEN_KEY = "subsync_token";
  const USER_KEY = "subsync_user";
  const SESSION_KEY = "subsync_auth_session";

  function storageGet(keys) {
    return new Promise((resolve) => {
      try {
        if (!chrome.storage || !chrome.storage.local) {
          resolve({});
          return;
        }
        chrome.storage.local.get(keys, (result) => resolve(result || {}));
      } catch (_) {
        resolve({});
      }
    });
  }

  function storageSet(values) {
    return new Promise((resolve) => {
      try {
        if (!chrome.storage || !chrome.storage.local) {
          resolve();
          return;
        }
        chrome.storage.local.set(values, resolve);
      } catch (_) {
        resolve();
      }
    });
  }

  function storageRemove(keys) {
    return new Promise((resolve) => {
      try {
        if (!chrome.storage || !chrome.storage.local) {
          resolve();
          return;
        }
        chrome.storage.local.remove(keys, resolve);
      } catch (_) {
        resolve();
      }
    });
  }

  function canMessageBackground() {
    return Boolean(
      typeof chrome !== "undefined" &&
      chrome.runtime &&
      typeof chrome.runtime.sendMessage === "function"
    );
  }

  function sendAuthMessage(message) {
    return new Promise((resolve, reject) => {
      if (!canMessageBackground()) {
        reject(new Error("SubSync 인증 서비스 워커를 찾을 수 없습니다."));
        return;
      }

      try {
        chrome.runtime.sendMessage(message, (response) => {
          const lastError = chrome.runtime.lastError;
          if (lastError) {
            reject(new Error(lastError.message));
            return;
          }
          resolve(response || {});
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  function userSummary(user) {
    if (!user || typeof user !== "object") return null;
    const metadata = user.user_metadata && typeof user.user_metadata === "object"
      ? user.user_metadata
      : {};
    return {
      id: user.id || "",
      email: user.email || "",
      nickname: metadata.nickname || metadata.full_name || metadata.name || user.email || ""
    };
  }

  function sessionProjection(session) {
    if (!session || typeof session !== "object" || !session.access_token) return null;
    return {
      access_token: session.access_token,
      expires_at: Number(session.expires_at) || 0,
      user: userSummary(session.user)
    };
  }

  async function fallbackSession() {
    const stored = await storageGet([SESSION_KEY, TOKEN_KEY, USER_KEY]);
    if (stored[SESSION_KEY] && stored[SESSION_KEY].access_token) {
      return sessionProjection(stored[SESSION_KEY]);
    }
    if (stored[TOKEN_KEY]) {
      return {
        access_token: stored[TOKEN_KEY],
        expires_at: 0,
        user: stored[USER_KEY] || null
      };
    }
    return null;
  }

  async function getSession() {
    if (canMessageBackground()) {
      try {
        const response = await sendAuthMessage({ type: "AUTH_GET_SESSION" });
        if (response && response.ok) return response.session || null;
      } catch (_) {
        // 서비스 워커가 잠시 깨어나는 동안에는 저장된 세션을 사용한다.
      }
    }
    return await fallbackSession();
  }

  async function updateAuthUI() {
    if (SubSync.layout && typeof SubSync.layout.updateAuthUI === "function") {
      await SubSync.layout.updateAuthUI();
    }
  }

  SubSync.authService = {
    async getToken() {
      const session = await getSession();
      return session && session.access_token ? session.access_token : null;
    },

    async getUser() {
      const session = await getSession();
      return session && session.user ? session.user : null;
    },

    async isAuthenticated() {
      return Boolean(await this.getToken());
    },

    async loginWithGoogle() {
      if (SubSync.authConfig && !SubSync.authConfig.isConfigured()) {
        throw new Error(SubSync.authConfig.getConfigurationError());
      }
      const response = await sendAuthMessage({ type: "AUTH_GOOGLE_LOGIN" });
      if (!response || !response.ok) {
        throw new Error((response && response.error) || "Google 로그인에 실패했습니다.");
      }
      return response.session || null;
    },

    async refreshSession() {
      const response = await sendAuthMessage({ type: "AUTH_GET_SESSION" });
      if (!response || !response.ok) {
        throw new Error((response && response.error) || "로그인 세션을 갱신하지 못했습니다.");
      }
      return response.session || null;
    },

    async logout() {
      try {
        if (canMessageBackground()) {
          await sendAuthMessage({ type: "AUTH_LOGOUT" });
        }
      } finally {
        await storageRemove([SESSION_KEY, TOKEN_KEY, USER_KEY]);
        await updateAuthUI();
      }
    },

    async login() {
      throw new Error("Google 로그인 버튼을 사용해주세요.");
    },

    async signup() {
      throw new Error("Google 계정으로 로그인하면 별도 회원가입 없이 계정이 생성됩니다.");
    }
  };
})();
