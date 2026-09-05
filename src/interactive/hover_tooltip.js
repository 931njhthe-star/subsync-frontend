// 마우스 Hover 시 빠른 단어 뜻 툴팁 표시기
(function () {
  const SubSync = (window.__SubSync = window.__SubSync || {});

  const HIDE_DELAY_MS = 280;
  const TOOLTIP_TRANSITION_MS = 180;
  let tooltipEl = null;
  let hideTimer = null;
  let exitTimer = null;
  let renderToken = 0;
  let targetActive = false;
  let tooltipActive = false;
  let currentWord = "";
  let currentSentence = "";
  let currentTarget = null;

  function clearHideTimer() {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
  }

  function clearExitTimer() {
    if (exitTimer) {
      clearTimeout(exitTimer);
      exitTimer = null;
    }
  }

  function hideNow() {
    clearHideTimer();
    clearExitTimer();
    renderToken += 1;
    targetActive = false;
    tooltipActive = false;
    currentWord = "";
    currentSentence = "";
    currentTarget = null;
    if (tooltipEl) {
      tooltipEl.classList.remove("subsync-tooltip-visible");
      tooltipEl.classList.add("subsync-tooltip-exiting");
      exitTimer = setTimeout(() => {
        if (tooltipEl && !targetActive && !tooltipActive) {
          tooltipEl.style.display = "none";
          tooltipEl.classList.remove("subsync-tooltip-exiting");
        }
        exitTimer = null;
      }, TOOLTIP_TRANSITION_MS);
    }
  }

  function scheduleHide() {
    clearHideTimer();
    hideTimer = setTimeout(() => {
      hideTimer = null;
      if (!targetActive && !tooltipActive) hideNow();
    }, HIDE_DELAY_MS);
  }

  function ensureTooltip() {
    if (tooltipEl) return tooltipEl;

    tooltipEl = document.createElement("div");
    tooltipEl.className = "subsync-hover-tooltip";
    tooltipEl.style.display = "none";
    tooltipEl.setAttribute("role", "tooltip");

    tooltipEl.addEventListener(
      "wheel",
      (event) => {
        event.preventDefault();
        event.stopPropagation();
      },
      { passive: false }
    );

    tooltipEl.addEventListener("mouseenter", () => {
      tooltipActive = true;
      clearHideTimer();
    });
    tooltipEl.addEventListener("mouseleave", () => {
      tooltipActive = false;
      scheduleHide();
    });

    document.body.appendChild(tooltipEl);
    return tooltipEl;
  }

  function positionTooltip(targetEl) {
    if (!targetEl || !tooltipEl) return;
    const rect = targetEl.getBoundingClientRect();
    tooltipEl.style.left = `${Math.max(8, rect.left + window.scrollX)}px`;
    tooltipEl.style.top = `${Math.max(8, rect.top + window.scrollY - 52)}px`;
  }

  function renderContent(word, sentence, targetEl, meaningText, isLoading) {
    const el = ensureTooltip();
    el.innerHTML = "";

    const top = document.createElement("div");
    top.className = "subsync-tt-top";

    const wordEl = document.createElement("span");
    wordEl.className = "subsync-tt-word";
    wordEl.textContent = word;
    top.appendChild(wordEl);

    const meaningEl = document.createElement("span");
    meaningEl.className = isLoading ? "subsync-tt-loading" : "subsync-tt-mean";
    meaningEl.textContent = isLoading ? "뜻 불러오는 중..." : meaningText;
    top.appendChild(meaningEl);

    const detailButton = document.createElement("button");
    detailButton.type = "button";
    detailButton.className = "subsync-tt-hint";
    detailButton.textContent = "클릭하여 자세히 보기 ›";
    detailButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      const selectedWord = word;
      const selectedSentence = sentence;
      const selectedTarget = targetEl;
      hideNow();

      if (SubSync.clickPopup && SubSync.clickPopup.show) {
        SubSync.clickPopup.show(selectedWord, selectedSentence, selectedTarget);
      }
    });

    el.appendChild(top);
    el.appendChild(detailButton);
  }

  SubSync.hoverTooltip = {
    show(word, targetEl, fullSentence) {
      clearHideTimer();
      targetActive = true;

      if (
        SubSync.settings &&
        (!SubSync.settings.get("subsyncEnabled") || !SubSync.settings.get("hoverLearning"))
      ) {
        hideNow();
        return;
      }

      if (!word || !targetEl) {
        this.leaveTarget();
        return;
      }

      currentWord = word;
      currentSentence = fullSentence || word;
      currentTarget = targetEl;
      const token = ++renderToken;
      const el = ensureTooltip();
      const wasHidden = el.style.display === "none" || !el.classList.contains("subsync-tooltip-visible");
      clearExitTimer();
      positionTooltip(targetEl);
      el.style.display = "block";
      el.classList.remove("subsync-tooltip-exiting");
      if (wasHidden) {
        void el.offsetWidth;
        el.classList.add("subsync-tooltip-visible");
      }
      renderContent(word, currentSentence, targetEl, "", true);

      Promise.resolve()
        .then(() => {
          if (!SubSync.dictService || !SubSync.dictService.getHoverMeaning) return null;
          return SubSync.dictService.getHoverMeaning(word);
        })
        .then((dict) => {
          if (token !== renderToken || currentWord !== word || !tooltipEl) return;
          const meaningText =
            dict && dict.meanings && dict.meanings.length ? dict.meanings.join(", ") : "단어";
          renderContent(word, currentSentence, targetEl, meaningText, false);
        })
        .catch(() => {
          if (token !== renderToken || currentWord !== word || !tooltipEl) return;
          renderContent(word, currentSentence, targetEl, "", false);
        });
    },

    leaveTarget() {
      targetActive = false;
      scheduleHide();
    },

    hide() {
      hideNow();
    }
  };
})();
