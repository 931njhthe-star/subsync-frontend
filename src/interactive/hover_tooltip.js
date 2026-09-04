// 마우스 Hover 시 빠른 단어 뜻 툴팁 표시기
(function () {
  const SubSync = (window.__SubSync = window.__SubSync || {});

  let tooltipEl = null;
  let hoverTimer = null;

  function ensureTooltip() {
    if (tooltipEl) return tooltipEl;
    tooltipEl = document.createElement("div");
    tooltipEl.className = "subsync-hover-tooltip";
    tooltipEl.style.display = "none";
    document.body.appendChild(tooltipEl);
    return tooltipEl;
  }

  SubSync.hoverTooltip = {
    show(word, targetEl) {
      clearTimeout(hoverTimer);

      // Hover 기능이 꺼져있거나 SubSync가 꺼져있으면 표시하지 않음
      if (SubSync.settings && (!SubSync.settings.get("subsyncEnabled") || !SubSync.settings.get("hoverLearning"))) {
        return;
      }

      if (!word) {
        this.hide();
        return;
      }

      hoverTimer = setTimeout(async () => {
        const el = ensureTooltip();
        const rect = targetEl.getBoundingClientRect();

        el.innerHTML = `
          <div class="subsync-tt-top">
            <span class="subsync-tt-word">${word}</span>
            <span class="subsync-tt-loading">뜻 불러오는 중...</span>
          </div>
          <div class="subsync-tt-hint">클릭하여 자세히 보기 ›</div>
        `;
        el.style.left = `${Math.max(8, rect.left + window.scrollX)}px`;
        el.style.top = `${Math.max(8, rect.top + window.scrollY - 52)}px`;
        el.style.display = "block";

        try {
          const dict = await SubSync.dictService.getHoverMeaning(word);
          const meaningText = (dict && dict.meanings && dict.meanings.length)
            ? dict.meanings.join(", ")
            : "단어";

          el.innerHTML = `
            <div class="subsync-tt-top">
              <span class="subsync-tt-word">${word}</span>
              <span class="subsync-tt-mean">${meaningText}</span>
            </div>
            <div class="subsync-tt-hint">클릭하여 자세히 보기 ›</div>
          `;
        } catch (_) {
          el.innerHTML = `
            <div class="subsync-tt-top">
              <span class="subsync-tt-word">${word}</span>
            </div>
            <div class="subsync-tt-hint">클릭하여 자세히 보기 ›</div>
          `;
        }
      }, 200); // 0.2초 즉각적 반응
    },

    hide() {
      clearTimeout(hoverTimer);
      if (tooltipEl) tooltipEl.style.display = "none";
    }
  };
})();
