// 탭 기반 다중 화면 레이아웃 컨테이너 및 빠른 설정 바
(function () {
  const SubSync = (window.__SubSync = window.__SubSync || {});

  let rootEl = null;
  let quickBarEl = null;
  let currentScreen = "video"; // "video" | "script" | "tutor" | "words" | "history" | "settings"

  SubSync.layout = {
    async ensureRoot() {
      if (rootEl) return rootEl;

      // 1. 빠른 설정 플로팅 바 (요구사항 3.2: [ SubSync ● ON ] 📜 ⚙)
      quickBarEl = document.createElement("div");
      quickBarEl.id = "subsync-quick-bar";
      quickBarEl.className = "subsync-quick-bar";
      quickBarEl.innerHTML = `
        <button id="subsync-toggle-main-btn" class="subsync-qb-toggle">SubSync <span class="subsync-dot on">● ON</span></button>
        <button id="subsync-qb-script-btn" class="subsync-qb-script" title="전체 스크립트 열기">📜 스크립트</button>
        <button id="subsync-qb-open-btn" class="subsync-qb-gear" title="학습 패널 열기">⚙️</button>
      `;
      document.body.appendChild(quickBarEl);

      // 2. 메인 화면 프레임
      rootEl = document.createElement("div");
      rootEl.id = "subsync-root";
      rootEl.className = "subsync-container";

      rootEl.innerHTML = `
        <div class="subsync-panel-header">
          <div class="subsync-brand-area">
            <span class="subsync-brand">SubSync</span>
            <span id="subsync-auth-status" class="subsync-auth-status-badge">비로그인</span>
          </div>
          <div class="subsync-header-controls">
            <button id="subsync-auth-btn" class="subsync-btn-small">로그인</button>
            <button id="subsync-close-btn" class="subsync-btn-close">×</button>
          </div>
        </div>

        <div class="subsync-nav-tabs">
          <button class="subsync-nav-btn active" data-screen="video">📺 영상학습</button>
          <button class="subsync-nav-btn" data-screen="tutor">🤖 AI 튜터</button>
          <button class="subsync-nav-btn" data-screen="words">⭐ 단어장</button>
          <button class="subsync-nav-btn" data-screen="history">📊 학습기록</button>
          <button class="subsync-nav-btn" data-screen="settings">⚙️ 설정</button>
        </div>

        <div class="subsync-body">
          <div id="subsync-screen-video" class="subsync-screen-panel active">
            <div id="subsync-subtitle-area" class="subsync-subtitle-box"></div>
            <div class="subsync-video-screen-actions">
              <button id="subsync-open-script-from-video" class="subsync-action-btn">📜 전체 스크립트 열기</button>
            </div>
          </div>
          <div id="subsync-screen-tutor" class="subsync-screen-panel" style="display: none;">
            <div id="subsync-tutor-area" class="subsync-tutor-box"></div>
          </div>
          <div id="subsync-screen-words" class="subsync-screen-panel" style="display: none;">
            <div id="subsync-words-area"></div>
          </div>
          <div id="subsync-screen-history" class="subsync-screen-panel" style="display: none;">
            <div id="subsync-history-area"></div>
          </div>
          <div id="subsync-screen-settings" class="subsync-screen-panel" style="display: none;">
            <div id="subsync-settings-area"></div>
          </div>
        </div>
      `;

      document.body.appendChild(rootEl);

      // 이벤트 바인딩
      this.bindEvents();
      this.updateAuthUI();

      return rootEl;
    },

    bindEvents() {
      // 닫기 / 열기
      document.getElementById("subsync-close-btn").addEventListener("click", () => {
        rootEl.style.display = "none";
      });
      document.getElementById("subsync-qb-open-btn").addEventListener("click", () => {
        rootEl.style.display = rootEl.style.display === "none" ? "flex" : "none";
      });

      // 독립 스크립트 패널 토글 (퀵바 & 영상학습 화면 내 버튼)
      document.getElementById("subsync-qb-script-btn").addEventListener("click", () => {
        if (SubSync.scriptPanel && SubSync.scriptPanel.toggle) {
          SubSync.scriptPanel.toggle();
        }
      });
      const videoScriptBtn = document.getElementById("subsync-open-script-from-video");
      if (videoScriptBtn) {
        videoScriptBtn.addEventListener("click", () => {
          if (SubSync.scriptPanel && SubSync.scriptPanel.open) {
            SubSync.scriptPanel.open();
          }
        });
      }

      // 전체 SubSync 토글
      document.getElementById("subsync-toggle-main-btn").addEventListener("click", async () => {
        const current = SubSync.settings.get("subsyncEnabled");
        await SubSync.settings.set("subsyncEnabled", !current);
        this.updateEnabledUI(!current);
      });

      // 네비게이션 탭 전환
      rootEl.querySelectorAll(".subsync-nav-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          const targetScreen = btn.dataset.screen;
          this.switchScreen(targetScreen);
        });
      });

      // 로그인/로그아웃 버튼
      document.getElementById("subsync-auth-btn").addEventListener("click", async () => {
        const isAuthed = await SubSync.authService.isAuthenticated();
        if (isAuthed) {
          await SubSync.authService.logout();
          this.updateAuthUI();
          alert("로그아웃 되었습니다.");
        } else {
          SubSync.authModal.show(() => this.updateAuthUI());
        }
      });
    },

    switchScreen(screenName) {
      currentScreen = screenName;
      rootEl.querySelectorAll(".subsync-nav-btn").forEach((b) => {
        b.classList.toggle("active", b.dataset.screen === screenName);
      });

      rootEl.querySelectorAll(".subsync-screen-panel").forEach((panel) => {
        panel.style.display = "none";
      });

      const activePanel = document.getElementById(`subsync-screen-${screenName}`);
      if (activePanel) activePanel.style.display = "block";

      // 화면별 동적 렌더링 호출
      if (screenName === "words") {
        SubSync.savedWordsView.render(document.getElementById("subsync-words-area"));
      } else if (screenName === "history") {
        SubSync.historyView.render(document.getElementById("subsync-history-area"));
      } else if (screenName === "settings") {
        SubSync.settingsView.render(document.getElementById("subsync-settings-area"));
      }
    },

    async updateAuthUI() {
      const isAuthed = await SubSync.authService.isAuthenticated();
      const badge = document.getElementById("subsync-auth-status");
      const authBtn = document.getElementById("subsync-auth-btn");
      if (!badge || !authBtn) return;

      if (isAuthed) {
        const user = await SubSync.authService.getUser();
        badge.textContent = user?.nickname || "로그인됨";
        badge.className = "subsync-auth-status-badge authed";
        authBtn.textContent = "로그아웃";
      } else {
        badge.textContent = "비로그인";
        badge.className = "subsync-auth-status-badge";
        authBtn.textContent = "로그인";
      }
    },

    updateEnabledUI(enabled) {
      const dot = document.querySelector(".subsync-dot");
      if (dot) {
        dot.textContent = enabled ? "● ON" : "○ OFF";
        dot.className = `subsync-dot ${enabled ? "on" : "off"}`;
      }
      if (!enabled) {
        const subArea = document.getElementById("subsync-subtitle-area");
        if (subArea) subArea.style.display = "none";
      } else {
        const subArea = document.getElementById("subsync-subtitle-area");
        if (subArea) subArea.style.display = "block";
      }
    },

    getSubtitleArea() { return document.getElementById("subsync-subtitle-area"); },
    getTutorArea() { return document.getElementById("subsync-tutor-area"); }
  };
})();
