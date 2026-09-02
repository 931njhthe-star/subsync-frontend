// 마우스 Click 시 단어 상세 설명 팝업 및 저장 모달
(function () {
  const SubSync = (window.__SubSync = window.__SubSync || {});

  let popupEl = null;

  function ensurePopup() {
    if (popupEl) return popupEl;
    popupEl = document.createElement("div");
    popupEl.className = "subsync-click-popup";
    popupEl.style.display = "none";
    document.body.appendChild(popupEl);

    document.addEventListener("click", (e) => {
      if (popupEl && !popupEl.contains(e.target) && !e.target.classList.contains("subsync-word")) {
        popupEl.style.display = "none";
      }
    });

    return popupEl;
  }

  SubSync.clickPopup = {
    async show(word, sentence, targetEl) {
      // 1. 로그인 여부 확인
      const isAuthed = await SubSync.authService.isAuthenticated();
      if (!isAuthed) {
        SubSync.authModal.show();
        return;
      }

      const el = ensurePopup();
      const rect = targetEl.getBoundingClientRect();
      el.style.left = `${Math.min(window.innerWidth - 320, Math.max(16, rect.left + window.scrollX))}px`;
      el.style.top = `${rect.bottom + window.scrollY + 8}px`;
      el.style.display = "block";
      el.innerHTML = `<div class="subsync-popup-loading">상세 설명 로딩 중...</div>`;

      // 로그 이벤트 기록 (비동기)
      SubSync.logService.recordClick(word, sentence);

      try {
        const data = await SubSync.dictService.getDetailMeaning(word, sentence);
        el.innerHTML = `
          <div class="subsync-popup-header">
            <span class="subsync-popup-word">${data.word}</span>
            <span class="subsync-popup-phonetic">${data.phonetic || ""}</span>
            <button class="subsync-popup-save-btn" id="subsync-save-word-btn">⭐ 저장</button>
          </div>
          <div class="subsync-popup-pos">${data.part_of_speech || "단어"}</div>
          <div class="subsync-popup-defs">${(data.definitions || []).map((d, i) => `<div>${i + 1}. ${d}</div>`).join("")}</div>
          ${data.context_meaning ? `<div class="subsync-popup-context">💡 <b>문맥 의미:</b> ${data.context_meaning}</div>` : ""}
        `;

        document.getElementById("subsync-save-word-btn").addEventListener("click", async () => {
          await SubSync.dictService.saveWord(word, (data.definitions || []).join(", "), sentence);
          document.getElementById("subsync-save-word-btn").textContent = "✅ 저장됨";
          document.getElementById("subsync-save-word-btn").disabled = true;
        });
      } catch (err) {
        el.innerHTML = `<div class="subsync-popup-error">상세 정보를 불러오지 못했습니다.</div>`;
      }
    },

    hide() {
      if (popupEl) popupEl.style.display = "none";
    }
  };
})();
