// 마우스 Click 시 단어 상세 설명 팝업/패널 및 저장 관리
(function () {
  const SubSync = (window.__SubSync = window.__SubSync || {});

  const POPUP_TRANSITION_MS = 220;
  let popupEl = null;
  let hideTimer = null;

  function clearHideTimer() {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
  }

  function showPopupElement(element) {
    if (!element) return;
    clearHideTimer();
    const wasHidden =
      element.style.display === "none" || !element.classList.contains("subsync-popup-visible");
    element.style.display = "block";
    element.classList.remove("subsync-popup-exiting");
    if (wasHidden) {
      void element.offsetWidth;
      element.classList.add("subsync-popup-visible");
    }
  }

  function hidePopupElement() {
    if (!popupEl) return;
    clearHideTimer();
    popupEl.classList.remove("subsync-popup-visible");
    popupEl.classList.add("subsync-popup-exiting");
    hideTimer = setTimeout(() => {
      if (popupEl) {
        popupEl.style.display = "none";
        popupEl.classList.remove("subsync-popup-exiting");
      }
      hideTimer = null;
    }, POPUP_TRANSITION_MS);
  }

  function ensurePopup() {
    if (popupEl) return popupEl;
    popupEl = document.createElement("div");
    popupEl.className = "subsync-click-popup";
    popupEl.style.display = "none";
    document.body.appendChild(popupEl);

    document.addEventListener("click", (e) => {
      if (
        popupEl &&
        popupEl.style.display !== "none" &&
        !popupEl.contains(e.target) &&
        !e.target.classList.contains("subsync-word")
      ) {
        hidePopupElement();
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        SubSync.clickPopup.hide();
      }
    });

    return popupEl;
  }

  SubSync.clickPopup = {
    async show(word, sentence, targetEl) {
      if (SubSync.settings && !SubSync.settings.get("subsyncEnabled")) return;

      // 1. 비로그인 사용자 클릭 시 로그인 여부 확인 및 안내 유도 (요구사항 2.1, 4.2)
      const isAuthed = await SubSync.authService.isAuthenticated();
      if (!isAuthed) {
        SubSync.authModal.show(() => {
          // 로그인 성공 후 원래 보려던 상세 정보 자연스럽게 노출
          this.show(word, sentence, targetEl);
        });
        return;
      }

      const el = ensurePopup();
      const rect = targetEl.getBoundingClientRect();
      el.style.left = `${Math.min(window.innerWidth - 320, Math.max(16, rect.left + window.scrollX))}px`;
      el.style.top = `${rect.bottom + window.scrollY + 8}px`;
      showPopupElement(el);
      el.innerHTML = `<div class="subsync-popup-loading">상세 설명 로딩 중...</div>`;

      // 클릭 로그 기록
      SubSync.logService.recordClick(word, sentence);

      try {
        const data = await SubSync.dictService.getDetailMeaning(word, sentence);
        const saveMode = (SubSync.settings && SubSync.settings.get("saveMode")) || "auto";

        const defsHtml = (data.definitions || [])
          .map((d, i) => `<div class="subsync-popup-def-item">${i + 1}. ${d}</div>`)
          .join("");

        const phrasesHtml = (data.phrases || [])
          .map((p) => `<div class="subsync-popup-phrase-item"><b>${p.expression}</b>: ${p.meaning}</div>`)
          .join("");

        el.innerHTML = `
          <div class="subsync-popup-header">
            <div>
              <span class="subsync-popup-word">${data.word}</span>
              <span class="subsync-popup-phonetic">${data.phonetic || ""}</span>
            </div>
            <button class="subsync-popup-save-btn" id="subsync-save-word-btn">
              ${saveMode === "auto" ? "✅ 자동 저장됨" : "⭐ 저장하기"}
            </button>
            <button type="button" class="subsync-popup-close-btn" aria-label="상세 학습 닫기">×</button>
          </div>
          <div class="subsync-popup-pos">${data.part_of_speech || "단어"} · ${(data.meanings || []).join(", ")}</div>
          ${defsHtml ? `<div class="subsync-popup-defs">${defsHtml}</div>` : ""}
          ${data.context_meaning ? `<div class="subsync-popup-context">💡 <b>문맥 의미:</b> ${data.context_meaning}</div>` : ""}
          ${phrasesHtml ? `<div class="subsync-popup-phrases"><div class="subsync-popup-phrases-title">관련 표현</div>${phrasesHtml}</div>` : ""}
        `;

        const saveBtn = document.getElementById("subsync-save-word-btn");
        const closeBtn = el.querySelector(".subsync-popup-close-btn");
        if (closeBtn) {
          closeBtn.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.hide();
          });
        }

        // 자동 저장 모드인 경우 즉시 백엔드 단어 저장
        if (saveMode === "auto") {
          saveBtn.disabled = true;
          await SubSync.dictService.saveWord(word, (data.meanings || []).join(", "), sentence);
        } else {
          // 수동 저장 모드: 사용자가 버튼 클릭 시 저장
          saveBtn.addEventListener("click", async () => {
            saveBtn.disabled = true;
            saveBtn.textContent = "저장 중...";
            await SubSync.dictService.saveWord(word, (data.meanings || []).join(", "), sentence);
            saveBtn.textContent = "✅ 저장됨";
          });
        }
      } catch (err) {
        el.innerHTML = `
          <div class="subsync-popup-error">
            <span>상세 정보를 불러오지 못했습니다.</span>
            <button type="button" class="subsync-popup-close-btn" aria-label="상세 학습 닫기">×</button>
          </div>
        `;
        const errorCloseBtn = el.querySelector(".subsync-popup-close-btn");
        if (errorCloseBtn) {
          errorCloseBtn.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.hide();
          });
        }
      }
    },

    hide() {
      hidePopupElement();
    }
  };
})();
