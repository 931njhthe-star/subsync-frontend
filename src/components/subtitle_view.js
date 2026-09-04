// YouTube 동영상 화면 위 실시간 이중자막 오버레이 및 사이드바 뷰어
(function () {
  const SubSync = (window.__SubSync = window.__SubSync || {});

  let overlayEl = null;
  let currentSub = null;

  function ensureVideoOverlay() {
    if (overlayEl && document.body.contains(overlayEl)) return overlayEl;

    const playerContainer =
      document.querySelector("#movie_player") ||
      document.querySelector(".html5-video-player") ||
      document.querySelector(".ytd-player");

    if (!playerContainer) return null;

    overlayEl = document.createElement("div");
    overlayEl.id = "subsync-video-caption-overlay";
    overlayEl.className = "subsync-video-caption-overlay";

    overlayEl.innerHTML = `
      <div class="subsync-overlay-content">
        <div class="subsync-overlay-en" id="subsync-overlay-en-text"></div>
        <div class="subsync-overlay-ko" id="subsync-overlay-ko-text"></div>
      </div>
    `;

    // position: relative 보장
    if (getComputedStyle(playerContainer).position === "static") {
      playerContainer.style.position = "relative";
    }

    playerContainer.appendChild(overlayEl);
    return overlayEl;
  }

  SubSync.subtitleView = {
    render(sideContainerEl, subtitle) {
      if (currentSub === subtitle) return;
      currentSub = subtitle;

      // 1. YouTube 영상 화면 위 오버레이 렌더링
      const overlay = ensureVideoOverlay();
      const isSubsyncEnabled = SubSync.settings ? SubSync.settings.get("subsyncEnabled") : true;
      const isDualSubEnabled = SubSync.settings ? SubSync.settings.get("dualSubtitle") : true;

      if (overlay) {
        if (!isSubsyncEnabled || !isDualSubEnabled || !subtitle) {
          overlay.style.display = "none";
        } else {
          overlay.style.display = "flex";
          const enEl = document.getElementById("subsync-overlay-en-text");
          const koEl = document.getElementById("subsync-overlay-ko-text");

          if (enEl) {
            SubSync.interactiveText.attach(enEl, subtitle.learn, subtitle.learn);
          }
          if (koEl) {
            koEl.textContent = subtitle.known || "";
            koEl.style.display = subtitle.known ? "block" : "none";
          }
        }
      }

      // 2. 우측 SubSync 패널 내부 렌더링
      if (sideContainerEl) {
        if (!subtitle) {
          sideContainerEl.innerHTML = `<div class="subsync-sub-empty">자막 재생 대기 중...</div>`;
          return;
        }

        sideContainerEl.innerHTML = `
          <div class="subsync-sub-learn" id="subsync-sub-learn-text"></div>
          <div class="subsync-sub-known">${subtitle.known || ""}</div>
        `;

        const learnSideEl = document.getElementById("subsync-sub-learn-text");
        if (learnSideEl) {
          SubSync.interactiveText.attach(learnSideEl, subtitle.learn, subtitle.learn);
        }
      }
    },

    clear() {
      currentSub = null;
      if (overlayEl) overlayEl.style.display = "none";
    }
  };
})();
