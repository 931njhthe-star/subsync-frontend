// 자막 파싱 및 시간 병합 엔진 (core)
(function () {
  const SubSync = (window.__SubSync = window.__SubSync || {});

  SubSync.getVideoId = function getVideoId() {
    try {
      const url = new URL(location.href);
      if (url.pathname === "/watch") return url.searchParams.get("v");
      const shorts = url.pathname.match(/^\/shorts\/([\w-]+)/);
      if (shorts) return shorts[1];
    } catch (_) {}
    return null;
  };

  SubSync.resolveNativeLang = function resolveNativeLang(nativeLangs, lang) {
    if (!lang) return null;
    if (nativeLangs.includes(lang)) return lang;
    const base = lang.split("-")[0];
    return nativeLangs.find((l) => l.split("-")[0] === base) || null;
  };

  function pickSourceLang(nativeLangs) {
    return (
      nativeLangs.find((l) => l === "en") ||
      nativeLangs.find((l) => l.startsWith("en")) ||
      nativeLangs[0] ||
      "en"
    );
  }

  function buildVariant(workingUrl, lang, nativeLangs, sourceLang) {
    const nativeCode = SubSync.resolveNativeLang(nativeLangs, lang);
    const u = new URL(workingUrl, location.origin);
    if (nativeCode) {
      u.searchParams.set("lang", nativeCode);
      u.searchParams.delete("tlang");
    } else {
      u.searchParams.set("lang", sourceLang);
      u.searchParams.set("tlang", lang);
    }
    u.searchParams.set("fmt", "json3");
    return u.toString();
  }

  function parseJson3(data) {
    const events = (data && data.events) || [];
    const lines = [];

    for (const ev of events) {
      if (!ev.segs) continue;
      const startSec = (ev.tStartMs || 0) / 1000;
      const durSec = (ev.dDurationMs || 0) / 1000;

      // segs 내의 단어/텍스트 결합
      const text = ev.segs
        .map((s) => s.utf8 || "")
        .join("")
        .replace(/\n/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      if (!text || text === "\n") continue;

      lines.push({
        start: startSec,
        end: startSec + durSec,
        text
      });
    }

    return lines;
  }

  // 문장 단위로 분할 및 병합하는 헬퍼
  function splitAndFormatSentences(rawLines) {
    if (!rawLines || !rawLines.length) return [];

    const result = [];
    let currentStart = rawLines[0].start;
    let currentEnd = rawLines[0].end;
    let currentText = "";

    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i];
      if (!currentText) {
        currentStart = line.start;
      }
      currentEnd = line.end;

      if (currentText && !currentText.endsWith(" ") && !line.text.startsWith(" ")) {
        currentText += " " + line.text;
      } else {
        currentText += line.text;
      }

      // 문장 종료 조건: . ! ? 로 끝나거나 뒤 문장과의 시간 간격이 2.5초 이상 벌어질 때
      const isSentenceEnd = /[.!?](\s*)$/.test(line.text.trim());
      const nextLine = rawLines[i + 1];
      const hasGap = nextLine && (nextLine.start - line.end > 2.0);
      const isLongEnough = currentText.length > 70;

      if (isSentenceEnd || hasGap || isLongEnough || !nextLine) {
        result.push({
          start: currentStart,
          end: currentEnd,
          text: currentText.trim()
        });
        currentText = "";
      }
    }

    return result.length ? result : rawLines;
  }

  async function fetchLines(url) {
    try {
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) return [];
      const text = await res.text();
      if (!text) return [];
      const data = JSON.parse(text);
      return parseJson3(data);
    } catch (err) {
      console.warn("[SubSync] 자막 파싱 오류 / URL:", url, err);
      return [];
    }
  }

  function findNearestText(lines, t, tolerance = 3.5) {
    let best = "";
    let bestDiff = Infinity;
    for (const line of lines) {
      const diff = Math.abs(line.start - t);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = line.text;
      }
    }
    return bestDiff <= tolerance ? best : "";
  }

  SubSync.buildSubtitlesFromUrl = async function buildSubtitlesFromUrl(
    videoId,
    workingUrl,
    opts
  ) {
    const tracks = (opts && opts.tracks) || [];
    const learnLang = (opts && opts.learnLang) || "en";
    const knownLang = (opts && opts.knownLang) || "ko";
    const nativeLangs = tracks.map((t) => t.lang || "");
    const sourceLang = pickSourceLang(nativeLangs);

    console.log("[SubSync] 자막 생성 시작:", { videoId, learnLang, knownLang, tracks, sourceLang });

    const rawLearnLines = await fetchLines(
      buildVariant(workingUrl, learnLang, nativeLangs, sourceLang)
    );
    if (!rawLearnLines.length) return [];

    let rawKnownLines = [];
    if (knownLang) {
      rawKnownLines = await fetchLines(
        buildVariant(workingUrl, knownLang, nativeLangs, sourceLang)
      );
    }

    // 통으로 뭉개지지 않도록 적절한 문장/시간 단위로 정제
    const learnLines = splitAndFormatSentences(rawLearnLines);
    const knownLines = rawKnownLines.length ? rawKnownLines : [];

    return learnLines.map((line) => {
      let matchedKo = "";
      if (knownLines.length) {
        matchedKo = findNearestText(knownLines, line.start, 3.5);
      }

      return {
        video_id: videoId,
        timestamp: line.start,
        end_timestamp: line.end,
        learn: line.text,
        known: matchedKo || ""
      };
    });
  };
})();
