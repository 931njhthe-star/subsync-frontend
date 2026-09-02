// 비로그인 사용자 Click 시 로그인 유도 모달
(function () {
  const SubSync = (window.__SubSync = window.__SubSync || {});

  let modalEl = null;

  function ensureModal() {
    if (modalEl) return modalEl;
    modalEl = document.createElement("div");
    modalEl.className = "subsync-auth-modal-overlay";
    modalEl.style.display = "none";

    modalEl.innerHTML = `
      <div class="subsync-auth-modal">
        <div class="subsync-auth-title">로그인이 필요합니다</div>
        <div class="subsync-auth-desc">단어 상세 설명 및 나만의 단어장 저장을 이용하려면 로그인이 필요합니다.</div>
        <div class="subsync-auth-inputs">
          <input type="email" id="subsync-auth-email" placeholder="이메일" />
          <input type="password" id="subsync-auth-password" placeholder="비밀번호" />
        </div>
        <div class="subsync-auth-actions">
          <button id="subsync-auth-login-btn" class="subsync-btn-primary">로그인</button>
          <button id="subsync-auth-cancel-btn" class="subsync-btn-secondary">닫기</button>
        </div>
      </div>
    `;

    document.body.appendChild(modalEl);

    document.getElementById("subsync-auth-cancel-btn").addEventListener("click", () => {
      modalEl.style.display = "none";
    });

    document.getElementById("subsync-auth-login-btn").addEventListener("click", async () => {
      const email = document.getElementById("subsync-auth-email").value.trim();
      const pw = document.getElementById("subsync-auth-password").value.trim();
      if (!email || !pw) return;

      try {
        await SubSync.authService.login(email, pw);
        alert("로그인 성공!");
        modalEl.style.display = "none";
      } catch (err) {
        alert("로그인 실패: " + err.message);
      }
    });

    return modalEl;
  }

  SubSync.authModal = {
    show() {
      const m = ensureModal();
      m.style.display = "flex";
    },
    hide() {
      if (modalEl) modalEl.style.display = "none";
    }
  };
})();
