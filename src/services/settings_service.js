// SubSync 사용자 설정 관리자
(function () {
  const SubSync = (window.__SubSync = window.__SubSync || {});

  const SETTINGS_KEY = "subsync_user_settings";
  const VALID_THEMES = Object.freeze(["dark", "light", "glass"]);

  function normalizeTheme(value) {
    return VALID_THEMES.includes(value) ? value : "dark";
  }

  const defaultSettings = {
    subsyncEnabled: true,       // SubSync 전체 ON/OFF
    dualSubtitle: true,         // 이중자막 ON/OFF
    hoverLearning: true,        // Hover 학습 ON/OFF
    scriptVisible: false,       // Script 패널 ON/OFF
    tutorEnabled: true,         // Video Tutor ON/OFF
    proactiveTutor: true,       // Tutor 선제 질문 ON/OFF
    saveMode: "auto",           // 단어 저장 방식: "auto" (좌클릭 시 자동 저장) | "manual" (저장 버튼 눌러 저장)
    theme: "dark"               // 화면 테마: "dark" | "light" | "glass"
  };

  SubSync.settings = {
    _state: { ...defaultSettings },
    _listeners: [],

    async init() {
      return new Promise((resolve) => {
        chrome.storage.local.get([SETTINGS_KEY], (res) => {
          if (res && res[SETTINGS_KEY]) {
            this._state = { ...defaultSettings, ...res[SETTINGS_KEY] };
            this._state.theme = normalizeTheme(this._state.theme);
          }
          resolve(this._state);
        });
      });
    },

    get(key) {
      return this._state[key];
    },

    getAll() {
      return { ...this._state };
    },

    async set(key, value) {
      if (key === "theme") {
        value = normalizeTheme(value);
      }
      this._state[key] = value;
      await this.save();
      this.notify(key, value);
    },

    async update(partial) {
      const next = { ...partial };
      if (Object.prototype.hasOwnProperty.call(next, "theme")) {
        next.theme = normalizeTheme(next.theme);
      }
      this._state = { ...this._state, ...next };
      await this.save();
      for (const [k, v] of Object.entries(next)) {
        this.notify(k, v);
      }
    },

    async save() {
      return new Promise((resolve) => {
        chrome.storage.local.set({ [SETTINGS_KEY]: this._state }, () => resolve());
      });
    },

    onChange(fn) {
      this._listeners.push(fn);
    },

    notify(key, val) {
      this._listeners.forEach((fn) => {
        try {
          fn(key, val, this._state);
        } catch (_) {}
      });
    }
  };
})();
