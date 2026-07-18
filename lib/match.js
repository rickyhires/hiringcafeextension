(() => {
  const ENTITIES = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
    ndash: '-', mdash: '-', rsquo: "'", lsquo: "'", ldquo: '"', rdquo: '"'
  };

  function decodeEntities(s) {
    return String(s || '')
      .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
      .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
      .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m);
  }

  function normText(s) {
    return decodeEntities(s)
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  const COMPANY_SUFFIXES = /\b(incorporated|inc|llc|llp|ltd|limited|corp|corporation|company|co|group|holdings|plc|gmbh|sa|ag|nv|the)\b/g;

  function normCompany(s) {
    return normText(s).replace(COMPANY_SUFFIXES, '').replace(/\s+/g, ' ').trim();
  }

  function tokenSet(s) {
    return new Set(s.split(' ').filter(Boolean));
  }

  function companyMatches(a, b) {
    const na = normCompany(a), nb = normCompany(b);
    if (!na || !nb) return false;
    if (na === nb) return true;
    if (na.includes(nb) || nb.includes(na)) return true;
    const ta = tokenSet(na), tb = tokenSet(nb);
    const inter = [...ta].filter(t => tb.has(t)).length;
    return inter > 0 && inter === Math.min(ta.size, tb.size);
  }

  function titleSimilarity(a, b) {
    const na = normText(a), nb = normText(b);
    if (!na || !nb) return 0;
    if (na === nb) return 1;
    if (na.includes(nb) || nb.includes(na)) return 0.95;
    const ta = tokenSet(na), tb = tokenSet(nb);
    const inter = [...ta].filter(t => tb.has(t)).length;
    return inter / Math.min(ta.size, tb.size);
  }

  const TITLE_MATCH_THRESHOLD = 0.6;

  function bestMatch(cards, job) {
    let best = null, bestScore = 0;
    for (const c of cards) {
      if (!companyMatches(c.company, job.company)) continue;
      const score = titleSimilarity(c.title, job.title);
      if (score >= TITLE_MATCH_THRESHOLD && score > bestScore) {
        best = c;
        bestScore = score;
      }
    }
    return best ? { ...best, score: bestScore } : null;
  }

  function simplifyLocation(loc) {
    if (!loc) return 'United States';
    let l = String(loc).split(/\s+or\s+/i)[0];
    l = l.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').replace(/,\s*$/, '').trim();
    return l || 'United States';
  }

  function indeedLocation(loc) {
    const l = simplifyLocation(loc);
    return l.replace(/,\s*united states$/i, '').trim() || 'United States';
  }

  function cleanTitle(title) {
    return String(title || '')
      .replace(/[([]\s*#?\d[\d-]*\s*[)\]]/g, ' ')
      .replace(/#\d+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function parseLinkedInCards(html) {
    const cards = [];
    const chunks = String(html || '').split(/<li[\s>]/i).slice(1);
    for (const chunk of chunks) {
      const title =
        chunk.match(/base-search-card__title[^>]*>\s*([^<]+)/)?.[1] ??
        chunk.match(/<span class="sr-only">\s*([^<]+)/)?.[1];
      const company =
        chunk.match(/base-search-card__subtitle[^>]*>[\s\S]*?<a[^>]*>\s*([^<]+)/)?.[1] ??
        chunk.match(/base-search-card__subtitle[^>]*>\s*([^<]+)/)?.[1];
      const url = chunk.match(/href="(https:\/\/[^"]*\/jobs\/view\/[^"]+)"/)?.[1];
      if (title && url) {
        cards.push({
          title: decodeEntities(title).trim(),
          company: decodeEntities(company || '').trim(),
          url: decodeEntities(url).split('?')[0]
        });
      }
    }
    return cards;
  }

  function parseIndeedCards(html) {
    const s = String(html || '');
    const cards = [];

    const jobkeyRe = /"jobkey"\s*:\s*"([a-f0-9]{10,20})"/g;
    let m;
    const keyIdxs = [];
    while ((m = jobkeyRe.exec(s)) !== null) keyIdxs.push({ key: m[1], idx: m.index });
    function fieldIn(lo, hi, anchor, field) {
      const slice = s.slice(lo, hi);
      const re = new RegExp('"' + field + '"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"', 'g');
      let best = null, bestDist = Infinity, mm;
      while ((mm = re.exec(slice)) !== null) {
        const dist = Math.abs(lo + mm.index - anchor);
        if (dist < bestDist) { bestDist = dist; best = mm[1]; }
      }
      if (best == null) return null;
      try { return JSON.parse('"' + best + '"'); } catch { return best; }
    }

    const seen = new Set();
    const SPAN = 9000;
    for (let n = 0; n < keyIdxs.length && cards.length < 25; n++) {
      const { key, idx } = keyIdxs[n];
      if (seen.has(key)) continue;
      seen.add(key);
      const lo = n > 0 ? Math.ceil((keyIdxs[n - 1].idx + idx) / 2) : Math.max(0, idx - SPAN);
      const hi = n < keyIdxs.length - 1 ? Math.floor((idx + keyIdxs[n + 1].idx) / 2) : idx + SPAN;
      const title = fieldIn(lo, hi, idx, 'displayTitle') ?? fieldIn(lo, hi, idx, 'title');
      const company = fieldIn(lo, hi, idx, 'company') ?? fieldIn(lo, hi, idx, 'companyName');
      if (title) {
        cards.push({
          title: String(title).trim(),
          company: String(company || '').trim(),
          url: 'https://www.indeed.com/viewjob?jk=' + key
        });
      }
    }
    if (cards.length) return cards;
    const titleRe = /jobTitle[^>]*>(?:\s*<span[^>]*title="([^"]+)")?/g;
    const anchors = [];
    while ((m = titleRe.exec(s)) !== null) anchors.push({ title: m[1] ? decodeEntities(m[1]) : null, idx: m.index });
    for (let i = 0; i < anchors.length && cards.length < 25; i++) {
      const a = anchors[i];
      if (!a.title) continue;
      const lo = Math.max(i > 0 ? anchors[i - 1].idx + 1 : 0, a.idx - 1500);
      const hi = i < anchors.length - 1 ? anchors[i + 1].idx : Math.min(s.length, a.idx + 6000);
      const seg = s.slice(lo, hi);
      const cm = /data-testid="company-name"[^>]*>([^<]+)</.exec(seg);
      const km = /jk=([a-f0-9]{10,20})/.exec(seg);
      cards.push({
        title: a.title.trim(),
        company: cm ? decodeEntities(cm[1]).trim() : '',
        url: km ? 'https://www.indeed.com/viewjob?jk=' + km[1] : ''
      });
    }
    return cards;
  }

  function looksLikeChallenge(html, status) {
    if ([401, 403, 429, 503].includes(status)) return true;
    return /just a moment|cf-browser-verification|challenge-platform|hcaptcha|verify you are a human/i
      .test(String(html || '').slice(0, 20000));
  }

  function indeedNoResults(html) {
    return /did not match any jobs|no jobs found|didn't find any results/i.test(String(html || ''));
  }

  globalThis.HCX_LIB = {
    decodeEntities, normText, normCompany, companyMatches, titleSimilarity,
    bestMatch, simplifyLocation, indeedLocation, cleanTitle,
    parseLinkedInCards, parseIndeedCards, looksLikeChallenge, indeedNoResults,
    TITLE_MATCH_THRESHOLD
  };
})();
