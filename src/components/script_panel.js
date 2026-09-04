// 전체 스크립트 독립 패널 (DOM 독립 생성, 타임스탬프 점프, 단어 인터랙션, 스크롤 & 시간 하이라이트)
(function () {
  const SubSync = (window.__SubSync = window.__SubSync || {});

  let containerEl = null;
  let listEl = null;
  let currentSubtitles = [];
  let isOpen = false;

  SubSync.scriptPanel = {
    ensureContainer() {
      if (containerEl) return containerEl;

      containerEl = document.createElement("div");
      containerEl.id = "subsync-script-panel";
      containerEl.className = "subsync-script-panel-container";
      containerEl.style.display = "none";

      containerEl.innerHTML = `
        <div class="subsync-script-panel-header">
          <div class="subsync-script-header-title">
            <span class="subsync-script-icon">📜</span>
            <span class="subsync-script-title-text">전체 Script</span>
          </div>
          <div class="subsync-script-header-actions">
            <button id="subsync-script-search-toggle" class="subsync-script-tool-btn" title="검색">🔍</button>
            <button id="subsync-script-close-btn" class="subsync-script-close-btn" title="닫기">×</button>
          </div>
        </div>
        <div id="subsync-script-search-bar" class="subsync-script-search-bar" style="display: none;">
          <input type="text" id="subsync-script-search-input" placeholder="스크립트 내 단어/문장 검색..." />
        </div>
        <div id="subsync-script-list" class="subsync-script-list">
          <div class="subsync-view-empty">자막 스크립트를 불러오는 중입니다...</div>
        </div>
      `;

      document.body.appendChild(containerEl);

      listEl = containerEl.querySelector("#subsync-script-list");

      // 닫기 버튼
      containerEl.querySelector("#subsync-script-close-btn").addEventListener("click", () => {
        this.close();
      });

      // 검색 토글 & 필터링
      const searchToggleBtn = containerEl.querySelector("#subsync-script-search-toggle");
      const searchBar = containerEl.querySelector("#subsync-script-search-bar");
      const searchInput = containerEl.querySelector("#subsync-script-search-input");

      searchToggleBtn.addEventListener("click", () => {
        const isShown = searchBar.style.display !== "none";
        searchBar.style.display = isShown ? "none" : "block";
        if (!isShown) searchInput.focus();
      });

      searchInput.addEventListener("input", (e) => {
        const query = e.target.value.toLowerCase().trim();
        this.filter(query);
      });

      return containerEl;
    },

    open() {
      this.ensureContainer();
      containerEl.style.display = "flex";
      isOpen = true;
    },

    close() {
      if (containerEl) {
        containerEl.style.display = "none";
      }
      isOpen = false;
    },

    toggle() {
      if (isOpen) {
        this.close();
      } else {
        this.open();
      }
    },

    setSubtitles(subtitles) {
      currentSubtitles = subtitles || [];
      this.ensureContainer();
      this.renderList(currentSubtitles);
    },

    renderList(subtitles) {
      if (!listEl) return;
      listEl.innerHTML = "";

      if (!subtitles || !subtitles.length) {
        listEl.innerHTML = `<div class="subsync-view-empty">자막 스크립트를 찾을 수 없습니다.</div>`;
        return;
      }

      const frag = document.createDocumentFragment();

      subtitles.forEach((sub, idx) => {
        const row = document.createElement("div");
        row.className = "subsync-script-row";
        row.dataset.timestamp = sub.timestamp;
        row.dataset.index = idx;

        const timeBtn = document.createElement("button");
        timeBtn.className = "subsync-script-time";
        const min = Math.floor(sub.timestamp / 60);
        const sec = Math.floor(sub.timestamp % 60);
        timeBtn.textContent = `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
        timeBtn.addEventListener("click", () => {
          if (SubSync.player && SubSync.player.seekTo) {
            SubSync.player.seekTo(sub.timestamp);
          }
        });

        const contentBox = document.createElement("div");
        contentBox.className = "subsync-script-content";

        const enEl = document.createElement("div");
        enEl.className = "subsync-script-en";
        // Script 영어 단어에도 공통 Mouse Interaction 적용
        if (SubSync.interactiveText && SubSync.interactiveText.attach) {
          SubSync.interactiveText.attach(enEl, sub.learn, sub.learn);
        } else {
          enEl.textContent = sub.learn || "";
        }

        const koEl = document.createElement("div");
        koEl.className = "subsync-script-ko";
        koEl.textContent = sub.known || "";

        contentBox.appendChild(enEl);
        if (sub.known) contentBox.appendChild(koEl);

        row.appendChild(timeBtn);
        row.appendChild(contentBox);
        frag.appendChild(row);
      });

      listEl.appendChild(frag);
    },

    filter(query) {
      if (!listEl) return;
      const rows = listEl.querySelectorAll(".subsync-script-row");
      rows.forEach((row) => {
        const text = row.textContent.toLowerCase();
        if (!query || text.includes(query)) {
          row.style.display = "flex";
        } else {
          row.style.display = "none";
        }
      });
    },

    highlightTime(currentTime) {
      if (!containerEl || containerEl.style.display === "none") return;

      const rows = listEl ? listEl.querySelectorAll(".subsync-script-row") : [];
      let activeRow = null;

      rows.forEach((row) => {
        const t = parseFloat(row.dataset.timestamp);
        if (Math.abs(t - currentTime) < 1.5) {
          row.classList.add("active");
          activeRow = row;
        } else {
          row.classList.remove("active");
        }
      });

      // 필요 시 활성 위치 자동 스크롤 (사용자가 수동 스크롤 중이지 않을 때)
      if (activeRow && listEl) {
        const topPos = activeRow.offsetTop - listEl.offsetTop;
        if (Math.abs(listEl.scrollTop - topPos) > 200) {
          listEl.scrollTo({ top: topPos - 40, behavior: "smooth" });
        }
      }
    }
  };
})();
