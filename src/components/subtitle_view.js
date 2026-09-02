// 실시간 이중자막 오버레이 뷰어
(function () {
  const SubSync = (window.__SubSync = window.__SubSync || {});

  let currentSub = null;

  SubSync.subtitleView = {
    render(containerEl, subtitle) {
      if (!containerEl) return;
      if (currentSub === subtitle) return;
      currentSub = subtitle;

      if (!subtitle) {
        containerEl.innerHTML = `<div class="subsync-sub-empty">자막 대기 중...</div>`;
        return;
      }

      containerEl.innerHTML = `
        <div class="subsync-sub-learn" id="subsync-sub-learn-text"></div>
        <div class="subsync-sub-known">${subtitle.known || ""}</div>
      `;

      const learnEl = document.getElementById("subsync-sub-learn-text");
      if (learnEl) {
        SubSync.interactiveText.attach(learnEl, subtitle.learn, subtitle.learn);
      }
    }
  };
})();
