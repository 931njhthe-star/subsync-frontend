// 세부 설정 화면
(function () {
  const SubSync = (window.__SubSync = window.__SubSync || {});

  SubSync.settingsView = {
    render(containerEl) {
      if (!containerEl) return;

      const s = SubSync.settings.getAll();

      containerEl.innerHTML = `
        <div class="subsync-settings-card">
          <div class="subsync-setting-row">
            <div>
              <div class="subsync-st-title">영·한 이중자막</div>
              <div class="subsync-st-desc">영어와 한국어 자막 동시 표시</div>
            </div>
            <label class="subsync-switch">
              <input type="checkbox" id="subsync-st-dual" ${s.dualSubtitle ? "checked" : ""}>
              <span class="subsync-slider"></span>
            </label>
          </div>

          <div class="subsync-setting-row">
            <div>
              <div class="subsync-st-title">Hover 단어 학습</div>
              <div class="subsync-st-desc">단어에 마우스 올리면 빠른 뜻 제공</div>
            </div>
            <label class="subsync-switch">
              <input type="checkbox" id="subsync-st-hover" ${s.hoverLearning ? "checked" : ""}>
              <span class="subsync-slider"></span>
            </label>
          </div>

          <div class="subsync-setting-row">
            <div>
              <div class="subsync-st-title">Tutor 선제 질문</div>
              <div class="subsync-st-desc">AI가 영상 속 유용한 표현을 먼저 질문</div>
            </div>
            <label class="subsync-switch">
              <input type="checkbox" id="subsync-st-proactive" ${s.proactiveTutor ? "checked" : ""}>
              <span class="subsync-slider"></span>
            </label>
          </div>

          <div class="subsync-setting-section">
            <div class="subsync-st-title">단어 저장 방식</div>
            <div class="subsync-radio-group">
              <label>
                <input type="radio" name="saveMode" value="auto" ${s.saveMode === "auto" ? "checked" : ""}>
                좌클릭 시 자동 저장
              </label>
              <label>
                <input type="radio" name="saveMode" value="manual" ${s.saveMode === "manual" ? "checked" : ""}>
                저장 버튼을 눌러 저장
              </label>
            </div>
          </div>
        </div>
      `;

      document.getElementById("subsync-st-dual")?.addEventListener("change", (e) => {
        SubSync.settings.set("dualSubtitle", e.target.checked);
      });
      document.getElementById("subsync-st-hover")?.addEventListener("change", (e) => {
        SubSync.settings.set("hoverLearning", e.target.checked);
      });
      document.getElementById("subsync-st-proactive")?.addEventListener("change", (e) => {
        SubSync.settings.set("proactiveTutor", e.target.checked);
      });
      containerEl.querySelectorAll('input[name="saveMode"]').forEach((radio) => {
        radio.addEventListener("change", (e) => {
          if (e.target.checked) {
            SubSync.settings.set("saveMode", e.target.value);
          }
        });
      });
    }
  };
})();
