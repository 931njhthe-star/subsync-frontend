// 저장 단어 화면 및 관리 뷰어
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

  function normalizeRemoteItems(response) {
    if (response && Array.isArray(response.items)) return response.items;
    if (response && Array.isArray(response.words)) return response.words;
    return [];
  }

  function formatTimestamp(timestamp) {
    if (!Number.isFinite(Number(timestamp))) return "";
    const total = Math.max(0, Math.floor(Number(timestamp)));
    return `⏱ ${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
  }

  SubSync.savedWordsView = {
    async getItems() {
      const localItems = SubSync.learningHistory
        ? await SubSync.learningHistory.getSavedWords()
        : [];

      try {
        const response = await SubSync.apiClient.request("/words/list");
        const remoteItems = normalizeRemoteItems(response);
        if (remoteItems.length) return { items: remoteItems, localOnly: false };
        return { items: localItems, localOnly: localItems.length > 0 };
      } catch (_) {
        return { items: localItems, localOnly: localItems.length > 0 };
      }
    },

    async render(containerEl) {
      if (!containerEl) return;

      const isAuthed = await SubSync.authService.isAuthenticated();
      if (!isAuthed) {
        containerEl.innerHTML = `
          <div class="subsync-view-empty">
            <p>저장된 단어를 확인하려면 로그인이 필요합니다.</p>
            <button id="subsync-saved-words-login-btn" class="subsync-btn-primary">로그인 / 회원가입</button>
          </div>
        `;
        document.getElementById("subsync-saved-words-login-btn")?.addEventListener("click", () => {
          SubSync.authModal.show(() => this.render(containerEl));
        });
        return;
      }

      containerEl.innerHTML = `<div class="subsync-view-loading">저장된 단어를 불러오는 중...</div>`;
      const { items, localOnly } = await this.getItems();

      if (!items.length) {
        containerEl.innerHTML = `<div class="subsync-view-empty">아직 저장한 단어가 없습니다. 영상 자막에서 단어를 클릭해 저장해보세요!</div>`;
        return;
      }

      const listHtml = items.map((item) => `
        <div class="subsync-saved-item" data-id="${escapeHtml(item.id)}">
          <div class="subsync-saved-main">
            <div class="subsync-saved-word-row">
              <span class="subsync-saved-word">${escapeHtml(item.word)}</span>
              ${formatTimestamp(item.timestamp) ? `<span class="subsync-saved-time">${formatTimestamp(item.timestamp)}</span>` : ""}
            </div>
            <div class="subsync-saved-meaning">${escapeHtml(item.meaning)}</div>
            ${item.context_sentence ? `<div class="subsync-saved-context">“${escapeHtml(item.context_sentence)}”</div>` : ""}
          </div>
          <button class="subsync-saved-del-btn" data-id="${escapeHtml(item.id)}" title="삭제">🗑️</button>
        </div>
      `).join("");

      containerEl.innerHTML = `
        <div class="subsync-saved-header">
          <span>총 <b>${items.length}</b>개 단어</span>
          ${localOnly ? `<small class="subsync-local-note">브라우저 임시 저장</small>` : ""}
        </div>
        <div class="subsync-saved-list">${listHtml}</div>
      `;

      containerEl.querySelectorAll(".subsync-saved-del-btn").forEach((button) => {
        button.addEventListener("click", async (event) => {
          event.stopPropagation();
          const id = button.dataset.id;
          const isLocal = String(id).startsWith("local_word_");

          try {
            if (!isLocal) {
              await SubSync.apiClient.request(`/words/${encodeURIComponent(id)}`, { method: "DELETE" });
            }
            if (SubSync.learningHistory) await SubSync.learningHistory.deleteSavedWord(id);
            await this.render(containerEl);
          } catch (error) {
            alert(`삭제 실패: ${error.message}`);
          }
        });
      });
    }
  };
})();
