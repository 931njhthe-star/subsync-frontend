// 학습 기록 화면 (단어, Tutor 대화, 영상 기록)
(function () {
  const SubSync = (window.__SubSync = window.__SubSync || {});

  SubSync.historyView = {
    async render(containerEl) {
      if (!containerEl) return;

      const isAuthed = await SubSync.authService.isAuthenticated();
      if (!isAuthed) {
        containerEl.innerHTML = `
          <div class="subsync-view-empty">
            <p>나의 학습 기록을 확인하려면 로그인이 필요합니다.</p>
            <button id="subsync-history-login-btn" class="subsync-btn-primary">로그인 / 회원가입</button>
          </div>
        `;
        document.getElementById("subsync-history-login-btn")?.addEventListener("click", () => {
          SubSync.authModal.show(() => this.render(containerEl));
        });
        return;
      }

      containerEl.innerHTML = `
        <div class="subsync-history-tabs">
          <button class="subsync-htab active" data-tab="words">단어 기록</button>
          <button class="subsync-htab" data-tab="video">시청 기록</button>
        </div>
        <div class="subsync-history-content" id="subsync-history-tab-body"></div>
      `;

      const tabBody = document.getElementById("subsync-history-tab-body");
      this.renderWordsHistory(tabBody);

      containerEl.querySelectorAll(".subsync-htab").forEach((tabBtn) => {
        tabBtn.addEventListener("click", () => {
          containerEl.querySelectorAll(".subsync-htab").forEach((b) => b.classList.remove("active"));
          tabBtn.classList.add("active");
          const tab = tabBtn.dataset.tab;
          if (tab === "words") this.renderWordsHistory(tabBody);
          else this.renderVideoHistory(tabBody);
        });
      });
    },

    async renderWordsHistory(containerEl) {
      containerEl.innerHTML = `<div class="subsync-view-loading">학습 기록 로딩 중...</div>`;
      try {
        const res = await SubSync.apiClient.request("/words/list");
        const items = (res && res.items) || [];

        if (!items.length) {
          containerEl.innerHTML = `<div class="subsync-view-empty">아직 학습 기록이 없습니다.</div>`;
          return;
        }

        containerEl.innerHTML = `
          <div class="subsync-history-list">
            ${items
              .map(
                (item) => `
              <div class="subsync-history-item">
                <div class="subsync-h-word">${item.word}</div>
                <div class="subsync-h-meaning">${item.meaning}</div>
                <div class="subsync-h-date">${item.created_at ? item.created_at.split("T")[0] : "최근"}</div>
              </div>
            `
              )
              .join("")}
          </div>
        `;
      } catch (err) {
        containerEl.innerHTML = `<div class="subsync-view-error">기록을 불러오지 못했습니다.</div>`;
      }
    },

    renderVideoHistory(containerEl) {
      const vid = SubSync.getVideoId ? SubSync.getVideoId() : "현재 영상";
      containerEl.innerHTML = `
        <div class="subsync-history-list">
          <div class="subsync-history-item">
            <div class="subsync-h-word">현재 학습 중인 영상</div>
            <div class="subsync-h-meaning">Video ID: ${vid}</div>
            <div class="subsync-h-date">오늘</div>
          </div>
        </div>
      `;
    }
  };
})();
