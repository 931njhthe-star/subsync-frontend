// Video Tutor 채팅창 및 피드백 컴포넌트
(function () {
  const SubSync = (window.__SubSync = window.__SubSync || {});

  let hasTriggeredProactive = false;

  SubSync.tutorChat = {
    init(containerEl) {
      if (!containerEl) return;

      containerEl.innerHTML = `
        <div class="subsync-tutor-box">
          <div class="subsync-tutor-header">${SubSync.icon("ai-tutor", "subsync-tutor-icon")}<span>Video Tutor (AI 학습 대화)</span></div>
          <div class="subsync-tutor-messages" id="subsync-tutor-msgs"></div>
          <div class="subsync-tutor-input-box">
            <input type="text" id="subsync-tutor-input" placeholder="영상 내용 질문하기..." />
            <button id="subsync-tutor-send-btn">전송</button>
          </div>
        </div>
      `;

      // 환영 인사(영어) 추가 및 영단어 마우스 인터랙션 자동 적용
      this.addMessage(
        "tutor",
        "Hello! Feel free to ask any questions about expressions or context in this video."
      );

      const input = document.getElementById("subsync-tutor-input");
      const sendBtn = document.getElementById("subsync-tutor-send-btn");

      const handleSend = async () => {
        const text = input.value.trim();
        if (!text) return;
        input.value = "";
        this.addMessage("user", text);

        try {
          const res = await SubSync.tutorService.ask(text);
          this.addMessage("tutor", res.reply, res.message_id);
        } catch (err) {
          this.addMessage("tutor", "답변을 불러오지 못했습니다. 네트워크를 확인해 주세요.");
        }
      };

      sendBtn.addEventListener("click", handleSend);
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") handleSend();
      });
    },

    triggerProactiveIfNeed(currentSubtitleEn) {
      // Tutor가 꺼져있거나 선제 질문이 꺼져있으면 실행하지 않음 (요구사항 6, 11)
      if (
        hasTriggeredProactive ||
        !SubSync.settings.get("subsyncEnabled") ||
        !SubSync.settings.get("tutorEnabled") ||
        !SubSync.settings.get("proactiveTutor")
      ) {
        return;
      }

      if (currentSubtitleEn && currentSubtitleEn.toLowerCase().includes("honest")) {
        hasTriggeredProactive = true;
        setTimeout(() => {
          this.addMessage(
            "tutor",
            "방금 'be honest with yourself'라는 표현이 나왔어요. 의미를 알고 있나요?"
          );
        }, 1000);
      }
    },

    addMessage(sender, text, messageId) {
      const msgsEl = document.getElementById("subsync-tutor-msgs");
      if (!msgsEl) return;

      const msgEl = document.createElement("div");
      msgEl.className = `subsync-msg ${sender}`;

      const textEl = document.createElement("div");
      textEl.className = "subsync-msg-text";

      if (sender === "tutor") {
        // AI 응답 내 영어 텍스트에도 동일한 Mouse Interaction 적용 (요구사항 4, 6)
        SubSync.interactiveText.attach(textEl, text);
      } else {
        textEl.textContent = text;
      }
      msgEl.appendChild(textEl);

      if (sender === "tutor" && messageId) {
        const fbEl = document.createElement("div");
        fbEl.className = "subsync-msg-feedback";
        fbEl.innerHTML = `
          <span class="subsync-fb-label">도움이 되었나요?</span>
          <button class="subsync-fb-btn" data-rating="up" title="도움됨">👍</button>
          <button class="subsync-fb-btn" data-rating="down" title="아쉬움">👎</button>
        `;
        fbEl.querySelectorAll(".subsync-fb-btn").forEach((btn) => {
          btn.addEventListener("click", async () => {
            const rating = btn.dataset.rating;
            await SubSync.tutorService.sendFeedback(messageId, rating);
            fbEl.innerHTML = `<span class="subsync-fb-done">피드백이 반영되었습니다.</span>`;
          });
        });
        msgEl.appendChild(fbEl);
      }

      msgsEl.appendChild(msgEl);
      msgsEl.scrollTop = msgsEl.scrollHeight;
    }
  };
})();
