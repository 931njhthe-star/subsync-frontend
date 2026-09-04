// 비로그인 사용자 좌클릭 시 로그인/회원가입 유도 모달
(function () {
  const SubSync = (window.__SubSync = window.__SubSync || {});

  let modalEl = null;
  let onSuccessCallback = null;
  let isSignupMode = false;

  function renderModalContent() {
    if (!modalEl) return;

    modalEl.innerHTML = `
      <div class="subsync-auth-modal">
        <div class="subsync-auth-header">
          <div class="subsync-auth-title">${isSignupMode ? "회원가입" : "더 자세한 내용을 보려면"}</div>
          <div class="subsync-auth-desc">
            ${isSignupMode ? "계정을 생성하여 나만의 단어장과 학습 기록을 관리하세요." : "단어 상세 학습 및 저장을 위해 로그인이 필요합니다."}
          </div>
        </div>

        <div class="subsync-auth-inputs">
          <input type="email" id="subsync-auth-email" placeholder="이메일 (예: user@example.com)" />
          <input type="password" id="subsync-auth-password" placeholder="비밀번호" />
          ${isSignupMode ? '<input type="text" id="subsync-auth-nickname" placeholder="닉네임 (선택)" />' : ""}
        </div>

        <div class="subsync-auth-actions">
          <button id="subsync-auth-submit-btn" class="subsync-btn-primary">
            ${isSignupMode ? "회원가입 완료" : "로그인"}
          </button>
          <button id="subsync-auth-cancel-btn" class="subsync-btn-secondary">닫기</button>
        </div>

        <div class="subsync-auth-footer">
          ${
            isSignupMode
              ? '이미 계정이 있으신가요? <a href="#" id="subsync-toggle-auth-mode">로그인하기</a>'
              : '계정이 없으신가요? <a href="#" id="subsync-toggle-auth-mode">회원가입하기</a>'
          }
        </div>
      </div>
    `;

    document.getElementById("subsync-auth-cancel-btn").addEventListener("click", () => {
      modalEl.style.display = "none";
    });

    document.getElementById("subsync-toggle-auth-mode").addEventListener("click", (e) => {
      e.preventDefault();
      isSignupMode = !isSignupMode;
      renderModalContent();
    });

    document.getElementById("subsync-auth-submit-btn").addEventListener("click", async () => {
      const email = document.getElementById("subsync-auth-email").value.trim();
      const pw = document.getElementById("subsync-auth-password").value.trim();
      if (!email || !pw) {
        alert("이메일과 비밀번호를 입력해주세요.");
        return;
      }

      const submitBtn = document.getElementById("subsync-auth-submit-btn");
      submitBtn.disabled = true;
      submitBtn.textContent = "처리 중...";

      try {
        if (isSignupMode) {
          const nick = document.getElementById("subsync-auth-nickname")?.value.trim();
          await SubSync.authService.signup(email, pw, nick);
          alert("회원가입 및 로그인이 완료되었습니다!");
        } else {
          await SubSync.authService.login(email, pw);
          alert("로그인되었습니다!");
        }

        modalEl.style.display = "none";
        if (SubSync.layout && SubSync.layout.updateAuthUI) {
          SubSync.layout.updateAuthUI();
        }

        if (typeof onSuccessCallback === "function") {
          onSuccessCallback();
        }
      } catch (err) {
        alert((isSignupMode ? "회원가입" : "로그인") + " 실패: " + err.message);
        submitBtn.disabled = false;
        submitBtn.textContent = isSignupMode ? "회원가입 완료" : "로그인";
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
    show(callback, openSignup = false) {
      onSuccessCallback = callback || null;
      isSignupMode = openSignup;
      const m = ensureModal();
      renderModalContent();
      m.style.display = "flex";
    },
    hide() {
      if (modalEl) modalEl.style.display = "none";
    }
  };
})();
