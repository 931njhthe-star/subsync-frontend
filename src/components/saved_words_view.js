// 저장 단어 화면 및 관리 뷰어
(function () {
  const SubSync = (window.__SubSync = window.__SubSync || {});

  SubSync.savedWordsView = {
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

      try {
        const res = await SubSync.apiClient.request("/words/list");
        const items = (res && res.items) || [];

        if (!items.length) {
          containerEl.innerHTML = `<div class="subsync-view-empty">아직 저장한 단어가 없습니다. 영상 자막에서 단어를 클릭해 저장해보세요!</div>`;
          return;
        }

        let listHtml = items
          .map(
            (item) => `
          <div class="subsync-saved-item" data-id="${item.id}">
            <div class="subsync-saved-main">
              <div class="subsync-saved-word-row">
                <span class="subsync-saved-word">${item.word}</span>
                ${item.timestamp ? `<span class="subsync-saved-time">⏱ ${Math.floor(item.timestamp / 60)}:${String(Math.floor(item.timestamp % 60)).padStart(2, "0")}</span>` : ""}
              </div>
              <div class="subsync-saved-meaning">${item.meaning}</div>
              ${item.context_sentence ? `<div class="subsync-saved-context">"${item.context_sentence}"</div>` : ""}
            </div>
            <button class="subsync-saved-del-btn" data-id="${item.id}" title="삭제">🗑️</button>
          </div>
        `
          )
          .join("");

        containerEl.innerHTML = `
          <div class="subsync-saved-header">
            <span>총 <b>${items.length}</b>개 단어</span>
          </div>
          <div class="subsync-saved-list">${listHtml}</div>
        `;

        // 단어 삭제 이벤트
        containerEl.querySelectorAll(".subsync-saved-del-btn").forEach((btn) => {
          btn.addEventListener("click", async (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            try {
              await SubSync.apiClient.request(`/words/${id}`, { method: "DELETE" });
              this.render(containerEl);
            } catch (err) {
              alert("삭제 실패: " + err.message);
            }
          });
        });
      } catch (err) {
        containerEl.innerHTML = `<div class="subsync-view-error">단어 목록을 불러오지 못했습니다.</div>`;
      }
    }
  };
})();
