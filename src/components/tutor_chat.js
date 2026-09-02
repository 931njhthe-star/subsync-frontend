// Video Tutor 채팅창 및 피드백 컴포넌트
(function () {
  const SubSync = (window.__SubSync = window.__SubSync || {});

  SubSync.tutorChat = {
    init(containerEl) {
      if (!containerEl) return;

      containerEl.innerHTML = `
        <div class="subsync-tutor-header">🤖 Video Tutor</div>
        <div class="subsync-tutor-messages" id="subsync-tutor-msgs">
          <div class="subsync-msg tutor">영상 시청 중 궁금한 표현이 있으면 물어보세요!</div>
        </div>
        <div class="subsync-tutor-input-box">
          <input type="text" id="subsync-tutor-input" placeholder="영상 내용 질문하기..." />
          <button id="subsync-tutor-send-btn">전송</button>
        </div>
      `;

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
          this.addMessage("tutor", "답변을 불러오지 못했습니다. 로그인을 확인해 주세요.");
        }
      };

      sendBtn.addEventListener("click", handleSend);
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") handleSend(); });
    },

    addMessage(sender, text, messageId) {
      const msgsEl = document.getElementById("subsync-tutor-msgs");
      if (!msgsEl) return;

      const msgEl = document.createElement("div");
      msgEl.className = `subsync-msg ${sender}`;

      const textEl = document.createElement("div");
      textEl.className = "subsync-msg-text";

      if (sender === "tutor") {
        // AI 응답 내 영어 텍스트에도 Mouse Interaction 적용
        SubSync.interactiveText.attach(textEl, text);
      } else {
        textEl.textContent = text;
      }
      msgEl.appendChild(textEl);

      if (sender === "tutor" && messageId) {
        const fbEl = document.createElement("div");
        fbEl.className = "subsync-msg-feedback";
        fbEl.innerHTML = `
          <button class="subsync-fb-btn" data-rating="up">👍</button>
          <button class="subsync-fb-btn" data-rating="down">👎</button>
        `;
        fbEl.querySelectorAll(".subsync-fb-btn").forEach((btn) => {
          btn.addEventListener("click", async () => {
            const rating = btn.dataset.rating;
            await SubSync.tutorService.sendFeedback(messageId, rating);
            fbEl.innerHTML = `<span class="subsync-fb-done">피드백 완료</span>`;
          });
        });
        msgEl.appendChild(fbEl);
      }

      msgsEl.appendChild(msgEl);
      msgsEl.scrollTop = msgsEl.scrollHeight;
    }
  };
})();
