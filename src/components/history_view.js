// 학습 기록 화면 (단어 학습, 영상 시청 기록)
(function () {
  const SubSync = (window.__SubSync = window.__SubSync || {});

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[character]);
  }

  function formatDate(value) {
    if (!value) return "최근";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return escapeHtml(value);
    return date.toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" });
  }

  function formatDuration(seconds) {
    const total = Math.max(0, Math.round(Number(seconds) || 0));
    const minutes = Math.floor(total / 60);
    const remainder = String(total % 60).padStart(2, "0");
    return `${minutes}:${remainder}`;
  }

  function historyService() {
    return SubSync.learningHistory;
  }

  function normalizeVideoId(value) {
    const videoId = String(value || "").trim();
    return /^[A-Za-z0-9_-]{6,20}$/.test(videoId) ? videoId : "";
  }

  function videoUrl(videoId) {
    return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
  }

  function thumbnailUrl(videoId) {
    return `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`;
  }

  function currentPageTitle(videoId) {
    if (typeof document === "undefined" || !SubSync.getVideoId || SubSync.getVideoId() !== videoId) return "";
    return String(document.title || "")
      .replace(/\s*-\s*YouTube\s*$/i, "")
      .trim();
  }

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

      const tabBody = containerEl.querySelector("#subsync-history-tab-body");
      await this.renderWordsHistory(tabBody);

      containerEl.querySelectorAll(".subsync-htab").forEach((tabBtn) => {
        tabBtn.addEventListener("click", () => {
          containerEl.querySelectorAll(".subsync-htab").forEach((button) => button.classList.remove("active"));
          tabBtn.classList.add("active");
          const tab = tabBtn.dataset.tab;
          void (tab === "words" ? this.renderWordsHistory(tabBody) : this.renderVideoHistory(tabBody));
        });
      });
    },

    async renderWordsHistory(containerEl) {
      if (!containerEl) return;
      containerEl.innerHTML = `<div class="subsync-view-loading">단어 기록을 불러오는 중...</div>`;

      const items = historyService() ? await historyService().getWordHistory() : [];
      if (!items.length) {
        containerEl.innerHTML = `<div class="subsync-view-empty">아직 학습한 단어가 없습니다.</div>`;
        return;
      }

      containerEl.innerHTML = `
        <div class="subsync-history-local-note">이 브라우저에 저장된 단어 학습 활동</div>
        <div class="subsync-history-list">
          ${items.map((item) => `
            <div class="subsync-history-item">
              <div class="subsync-history-item-head">
                <div class="subsync-h-word">${escapeHtml(item.word)}</div>
                <span class="subsync-history-activity">${item.activity === "saved" ? "저장" : "클릭 학습"}</span>
              </div>
              ${item.meaning ? `<div class="subsync-h-meaning">${escapeHtml(item.meaning)}</div>` : ""}
              ${item.context_sentence ? `<div class="subsync-h-context">“${escapeHtml(item.context_sentence)}”</div>` : ""}
              <div class="subsync-h-date">${formatDate(item.created_at || item.saved_at)}</div>
            </div>
          `).join("")}
        </div>
      `;
    },

    async renderVideoHistory(containerEl) {
      if (!containerEl) return;
      containerEl.innerHTML = `<div class="subsync-view-loading">시청 기록을 불러오는 중...</div>`;

      const items = historyService() ? await historyService().getVideoHistory() : [];
      if (!items.length) {
        containerEl.innerHTML = `<div class="subsync-view-empty">아직 시청 기록이 없습니다. 영상을 재생해보세요.</div>`;
        return;
      }

      containerEl.innerHTML = `
        <div class="subsync-history-local-note">영상 재생 중 누적된 이 브라우저의 시청 기록</div>
        <div class="subsync-history-list">
          ${items.map((item) => {
            const videoId = normalizeVideoId(item.video_id);
            const title = item.title || currentPageTitle(videoId) || (videoId ? `영상 ${videoId}` : "제목을 불러올 수 없는 영상");
            const href = videoId ? videoUrl(videoId) : "#";
            const thumbnail = videoId ? thumbnailUrl(videoId) : "";
            const thumbnailHtml = thumbnail
              ? `<a class="subsync-history-video-thumb" href="${href}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(title)} 영상 열기"><img src="${thumbnail}" alt="${escapeHtml(title)} 썸네일" loading="lazy" /></a>`
              : `<div class="subsync-history-video-thumb subsync-history-video-thumb-empty" aria-hidden="true"></div>`;
            const titleHtml = videoId
              ? `<a class="subsync-history-video-title" href="${href}" target="_blank" rel="noopener noreferrer">${escapeHtml(title)}</a>`
              : `<span class="subsync-history-video-title">${escapeHtml(title)}</span>`;
            return `
              <div class="subsync-history-item subsync-history-video-item">
                ${thumbnailHtml}
                <div class="subsync-history-video-info">
                  ${titleHtml}
                  <div class="subsync-h-meaning">누적 시청: ${formatDuration(item.watched_seconds)}</div>
                  <div class="subsync-h-date">마지막 시청 ${formatDate(item.last_watched_at)}</div>
                </div>
              </div>
            `;
          }).join("")}
        </div>
      `;
    }
  };
})();
