// 전체 스크립트 패널 (ON/OFF, timestamp 이동, 마우스 인터랙션)
(function () {
  const SubSync = (window.__SubSync = window.__SubSync || {});

  let isVisible = false;

  SubSync.scriptPanel = {
    init(toggleBtn, scriptContainer, subtitles) {
      if (!toggleBtn || !scriptContainer) return;

      toggleBtn.addEventListener("click", () => {
        isVisible = !isVisible;
        scriptContainer.style.display = isVisible ? "block" : "none";
        toggleBtn.textContent = isVisible ? "📜 Script [ON]" : "📜 Script [OFF]";
        toggleBtn.classList.toggle("active", isVisible);
      });

      this.renderList(scriptContainer, subtitles);
    },

    renderList(containerEl, subtitles) {
      containerEl.innerHTML = "";
      const frag = document.createDocumentFragment();

      (subtitles || []).forEach((sub) => {
        const row = document.createElement("div");
        row.className = "subsync-script-row";
        row.dataset.timestamp = sub.timestamp;

        const timeBtn = document.createElement("button");
        timeBtn.className = "subsync-script-time";
        const min = Math.floor(sub.timestamp / 60);
        const sec = Math.floor(sub.timestamp % 60);
        timeBtn.textContent = `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
        timeBtn.addEventListener("click", () => SubSync.player.seekTo(sub.timestamp));

        const contentBox = document.createElement("div");
        contentBox.className = "subsync-script-content";

        const enEl = document.createElement("div");
        enEl.className = "subsync-script-en";
        SubSync.interactiveText.attach(enEl, sub.learn, sub.learn);

        const koEl = document.createElement("div");
        koEl.className = "subsync-script-ko";
        koEl.textContent = sub.known || "";

        contentBox.appendChild(enEl);
        if (sub.known) contentBox.appendChild(koEl);

        row.appendChild(timeBtn);
        row.appendChild(contentBox);
        frag.appendChild(row);
      });

      containerEl.appendChild(frag);
    },

    highlightTime(currentTime) {
      const rows = document.querySelectorAll(".subsync-script-row");
      rows.forEach((row) => {
        const t = parseFloat(row.dataset.timestamp);
        if (Math.abs(t - currentTime) < 1.5) {
          row.classList.add("active");
        } else {
          row.classList.remove("active");
        }
      });
    }
  };
})();
