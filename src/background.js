// MV3 서비스 워커.
// 확장 프로그램의 백그라운드 이벤트 처리 진입점.

chrome.runtime.onInstalled.addListener(() => {
  console.log("[YLTK] extension installed");
});
