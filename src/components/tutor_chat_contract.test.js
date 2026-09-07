const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const tutorChat = fs.readFileSync(path.join(__dirname, "tutor_chat.js"), "utf8");
const tutorService = fs.readFileSync(path.join(__dirname, "..", "services", "tutor_service.js"), "utf8");
const contentMain = fs.readFileSync(path.join(__dirname, "..", "content_main.js"), "utf8");

test("Tutor UI sends nearby subtitle context to the ask service", () => {
  assert.match(tutorChat, /tutorService\.ask\(text,\s*getRecentSubtitles\(\)\)/);
  assert.match(contentMain, /SubSync\.getRecentSubtitles\s*=\s*function/);
});

test("Tutor UI sends the backend conversation ID with feedback", () => {
  assert.match(
    tutorChat,
    /tutorService\.sendFeedback\(\s*messageId,\s*rating,\s*undefined,\s*conversationId\s*\)/
  );
  assert.match(tutorService, /conversation_id:\s*requestedConversationId \|\| conversationId/);
});

test("Tutor proactive checks use the backend service contract", () => {
  assert.match(tutorChat, /tutorService\.checkProactive\(recentSubtitles,\s*\{/);
  assert.match(tutorService, /recent_subtitles:\s*normalizeSubtitles\(recentSubtitles\)/);
});
