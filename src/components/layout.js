// 2열 메인 레이아웃 프레임 생성기
(function () {
  const SubSync = (window.__SubSync = window.__SubSync || {});

  let rootEl = null;

  SubSync.layout = {
    ensureRoot() {
      if (rootEl) return rootEl;
      rootEl = document.createElement("div");
      rootEl.id = "subsync-root";
      rootEl.className = "subsync-container";

      rootEl.innerHTML = `
        <div class="subsync-panel-header">
          <div class="subsync-brand">SubSync</div>
          <div class="subsync-header-controls">
            <button id="subsync-toggle-script-btn" class="subsync-btn-small">📜 Script [OFF]</button>
            <button id="subsync-close-btn" class="subsync-btn-close">×</button>
          </div>
        </div>
        <div class="subsync-body">
          <div id="subsync-subtitle-area" class="subsync-subtitle-box"></div>
          <div id="subsync-script-area" class="subsync-script-box" style="display: none;"></div>
          <div id="subsync-tutor-area" class="subsync-tutor-box"></div>
        </div>
      `;

      document.body.appendChild(rootEl);

      document.getElementById("subsync-close-btn").addEventListener("click", () => {
        rootEl.style.display = "none";
      });

      return rootEl;
    },

    getSubtitleArea() { return document.getElementById("subsync-subtitle-area"); },
    getScriptArea() { return document.getElementById("subsync-script-area"); },
    getTutorArea() { return document.getElementById("subsync-tutor-area"); }
  };
})();
