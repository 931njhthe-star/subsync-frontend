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
      const text = ev.segs
        .map((s) => s.utf8 || "")
        .join("")
        .replace(/\s+/g, " ")
        .trim();
      if (!text) continue;
      lines.push({ start: (ev.tStartMs || 0) / 1000, text });
    }
    return lines;
  }

  async function fetchLines(url) {
    const res = await fetch(url, { credentials: "include" });
    const text = await res.text();
    if (!text) return [];
    let data;
    try {
      data = JSON.parse(text);
    } catch (_) {
      return [];
    }
    return parseJson3(data);
  }

  function findNearestText(lines, t, tolerance) {
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
    const learnLang = opts && opts.learnLang;
    const knownLang = opts && opts.knownLang;
    const nativeLangs = tracks.map((t) => t.lang || "");
    const sourceLang = pickSourceLang(nativeLangs);

    const learnLines = await fetchLines(
      buildVariant(workingUrl, learnLang, nativeLangs, sourceLang)
    );
    if (!learnLines.length) return [];

    let knownLines = [];
    if (knownLang) {
      knownLines = await fetchLines(
        buildVariant(workingUrl, knownLang, nativeLangs, sourceLang)
      );
    }

    return learnLines.map((line) => ({
      video_id: videoId,
      timestamp: line.start,
      learn: line.text,
      known: knownLang ? findNearestText(knownLines, line.start, 1.5) : "",
    }));
  };
})();
