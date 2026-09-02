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
      if (!word) {
        this.hide();
        return;
      }

      hoverTimer = setTimeout(async () => {
        const el = ensureTooltip();
        const rect = targetEl.getBoundingClientRect();

        el.innerHTML = `<span class="subsync-tt-word">${word}</span> <span class="subsync-tt-loading">뜻 불러오는 중...</span>`;
        el.style.left = `${rect.left + window.scrollX}px`;
        el.style.top = `${rect.top + window.scrollY - 34}px`;
        el.style.display = "block";

        try {
          const dict = await SubSync.dictService.getHoverMeaning(word);
          if (dict && dict.meanings && dict.meanings.length) {
            el.innerHTML = `<span class="subsync-tt-word">${word}</span>: ${dict.meanings.join(", ")}`;
          } else {
            el.innerHTML = `<span class="subsync-tt-word">${word}</span>`;
          }
        } catch (_) {
          el.innerHTML = `<span class="subsync-tt-word">${word}</span>`;
        }
      }, 300); // 0.3초 안정적 딜레이
    },

    hide() {
      clearTimeout(hoverTimer);
      if (tooltipEl) tooltipEl.style.display = "none";
    }
  };
})();
