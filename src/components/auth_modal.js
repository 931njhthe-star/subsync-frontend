// Google OAuth 로그인 모달
(function () {
  const SubSync = (window.__SubSync = window.__SubSync || {});

  let modalEl = null;
  let onSuccessCallback = null;
  let hideTimer = null;

  const MODAL_TRANSITION_MS = 240;

  function clearHideTimer() {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
  }

  function hideModal() {
    if (!modalEl) return;
    clearHideTimer();
    modalEl.classList.remove("subsync-modal-visible");
    modalEl.classList.add("subsync-modal-exiting");
    hideTimer = setTimeout(() => {
      if (modalEl) {
        modalEl.style.display = "none";
        modalEl.classList.remove("subsync-modal-exiting");
      }
      hideTimer = null;
    }, MODAL_TRANSITION_MS);
  }

  function showModal(element) {
    if (!element) return;
    clearHideTimer();
    element.style.display = "flex";
    element.classList.remove("subsync-modal-exiting");
    void element.offsetWidth;
    element.classList.add("subsync-modal-visible");
  }

  function googleButtonMarkup() {
    return SubSync.icon("google", "subsync-auth-google-icon");
  }

  function renderGoogleButton(button, label, isBusy = false) {
    if (!button) return;
    button.innerHTML = googleButtonMarkup();
    button.setAttribute("aria-label", label);
    button.title = label;
    if (isBusy) {
      button.setAttribute("aria-busy", "true");
    } else {
      button.removeAttribute("aria-busy");
    }
  }

  function renderModalContent() {
    if (!modalEl) return;

    modalEl.innerHTML = `
      <div class="subsync-auth-modal" role="dialog" aria-modal="true" aria-labelledby="subsync-auth-title">
        <div class="subsync-auth-header">
          <div class="subsync-auth-title" id="subsync-auth-title">SubSync 로그인</div>
          <div class="subsync-auth-desc">
            Google 계정으로 로그인하면 나만의 단어장과 학습 기록을 관리할 수 있습니다.
          </div>
        </div>

        <div class="subsync-auth-actions subsync-auth-google-actions">
          <button
            id="subsync-auth-google-btn"
            class="subsync-btn-primary subsync-auth-google-btn"
            type="button"
            aria-label="Google로 계속하기"
            title="Google로 계속하기"
          >
            ${googleButtonMarkup()}
          </button>
          <button id="subsync-auth-cancel-btn" class="subsync-btn-secondary" type="button">닫기</button>
        </div>

        <div class="subsync-auth-footer">
          로그인하면 SubSync의 단어 저장 및 학습 기록 기능을 사용할 수 있습니다.
        </div>
      </div>
    `;

    document.getElementById("subsync-auth-cancel-btn")?.addEventListener("click", () => {
      hideModal();
    });

    document.getElementById("subsync-auth-google-btn")?.addEventListener("click", async () => {
      const button = document.getElementById("subsync-auth-google-btn");
      if (!button || button.disabled) return;

      button.disabled = true;
      renderGoogleButton(button, "Google 로그인 연결 중...", true);

      try {
        await SubSync.authService.loginWithGoogle();
        hideModal();
        if (SubSync.layout && typeof SubSync.layout.updateAuthUI === "function") {
          await SubSync.layout.updateAuthUI();
        }
        if (typeof onSuccessCallback === "function") {
          await onSuccessCallback();
        }
      } catch (error) {
        alert(`Google 로그인 실패: ${error.message}`);
        button.disabled = false;
        renderGoogleButton(button, "Google로 계속하기", false);
      }
    });
  }

  function ensureModal() {
    if (modalEl) return modalEl;
    modalEl = document.createElement("div");
    modalEl.className = "subsync-auth-modal-overlay";
    modalEl.style.display = "none";
    document.body.appendChild(modalEl);
    return modalEl;
  }

  SubSync.authModal = {
    show(callback) {
      onSuccessCallback = callback || null;
      const m = ensureModal();
      renderModalContent();
      showModal(m);
    },
    hide() {
      hideModal();
    }
  };
})();
