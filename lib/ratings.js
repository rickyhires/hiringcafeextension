(() => {
  'use strict';
  const L = () => globalThis.HCX_LIB;
  const norm = s => (L() ? L().normCompany(s) : String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim());

  function parseIndeedCompanies(html) {
    const s = String(html || '');
    const out = [];
    const re = /href="(\/cmp\/[^"?#]+)"/g;
    let m;
    const idxs = [];
    while ((m = re.exec(s)) !== null) {
      const href = m[1];
      if (/\/cmp\/[^/]+\/(reviews|salaries|jobs|faq|about|photos)/.test(href)) continue;
      idxs.push({ href, idx: m.index });
    }
    const seen = new Set();
    for (let n = 0; n < idxs.length && out.length < 20; n++) {
      const { href, idx } = idxs[n];
      const slug = href.split('/')[2];
      if (!slug || seen.has(slug)) continue;
      seen.add(slug);
      const lo = Math.max(0, idx - 1200);
      const hi = Math.min(s.length, idx + 1800);
      const seg = s.slice(lo, hi);
      let name = slug.replace(/-/g, ' ');
      try { name = decodeURIComponent(slug).replace(/-/g, ' '); } catch { }
      const nameM = seg.match(/aria-label="([^"]{2,80}?)\s+(?:company )?reviews?"/i)
        || seg.match(/>([^<>{}]{2,80})<\/[a-z]+><[^>]*>\s*\d\.\d/i);
      if (nameM) name = nameM[1].trim();
      let rating = null;
      const rM = seg.match(/(\d(?:\.\d{1,2})?)\s*out of 5/i)
        || seg.match(/aria-label="(\d(?:\.\d{1,2})?)\s*(?:out of 5|stars?)/i)
        || seg.match(/"ratingValue"\s*:\s*"?(\d(?:\.\d{1,2})?)"?/);
      if (rM) rating = parseFloat(rM[1]);

      let count = null;
      const cM = seg.match(/([\d,]+)\s*(?:company )?reviews?/i) || seg.match(/"reviewCount"\s*:\s*"?([\d,]+)"?/);
      if (cM) count = parseInt(cM[1].replace(/,/g, ''), 10);
      if (rating != null && rating >= 0 && rating <= 5) {
        out.push({ name, rating, count, url: 'https://www.indeed.com' + href });
      }
    }
    return out;
  }
  function nameMatch(candidateNorm, t) {
    if (!candidateNorm) return 0;
    if (candidateNorm === t) return 3;
    if (t.length >= 4 && candidateNorm.length >= 4 && (candidateNorm.startsWith(t) || t.startsWith(candidateNorm))) return 2;
    if (t.length >= 5 && candidateNorm.length >= 5 && (candidateNorm.includes(t) || t.includes(candidateNorm))) return 1;
    return 0;
  }
  function bestCompanyMatch(companies, targetName) {
    if (!companies || !companies.length) return null;
    const t = norm(targetName);
    if (!t) return null;
    let best = null, bestTier = 0;
    for (const c of companies) {
      const tier = nameMatch(norm(c.name), t);
      if (tier === 0) continue;
      if (tier > bestTier || (tier === bestTier && (c.count || 0) > (best.count || 0))) { best = c; bestTier = tier; }
    }
    return best;
  }

  function parseGlassdoorFind(jsonText) {
    let data;
    try { data = typeof jsonText === 'string' ? JSON.parse(jsonText) : jsonText; } catch { return []; }
    const arr = Array.isArray(data) ? data : (data.employers || data.results || []);
    return (arr || []).map(e => ({
      id: e.id || e.employerId || e.value,
      label: e.label || e.name || e.shortName,
      shortName: e.shortName || e.label,
      websiteUrl: e.websiteURL || e.websiteUrl || null
    })).filter(e => e.id && e.label);
  }

  function glassdoorReviewsUrl(label, id) {
    const slug = String(label || 'Company').trim().replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'Company';
    return `https://www.glassdoor.com/Reviews/${slug}-Reviews-E${id}.htm`;
  }

  function parseGlassdoorRating(html) {
    const s = String(html || '');
    const ldRe = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
    let m;
    while ((m = ldRe.exec(s)) !== null) {
      try {
        const j = JSON.parse(m[1].trim());
        const nodes = Array.isArray(j) ? j : [j];
        for (const node of nodes) {
          const agg = node.aggregateRating || (node['@type'] === 'EmployerAggregateRating' ? node : null);
          if (agg && (agg.ratingValue != null)) {
            return { rating: parseFloat(agg.ratingValue), count: parseInt(agg.reviewCount || agg.ratingCount || 0, 10) || null };
          }
        }
      } catch { }
    }
    const rM = s.match(/"overallRating"\s*:\s*"?(\d(?:\.\d{1,2})?)"?/) || s.match(/"ratingValue"\s*:\s*"?(\d(?:\.\d{1,2})?)"?/);
    const cM = s.match(/"reviewCount"\s*:\s*"?([\d,]+)"?/) || s.match(/"ratingCount"\s*:\s*"?([\d,]+)"?/);
    if (rM) {
      const rating = parseFloat(rM[1]);
      if (rating >= 0 && rating <= 5) return { rating, count: cM ? parseInt(cM[1].replace(/,/g, ''), 10) : null };
    }
    return { rating: null, count: null };
  }

  function parseLevels(html) {
    const s = String(html || '');
    const m = s.match(/"medianCompensation"\s*:\s*(\d+)/) || s.match(/"totalCompensation"\s*:\s*(\d+)/);
    return { median: m ? parseInt(m[1], 10) : null };
  }

  async function indeedCompany(name, indeedFetch) {
    try {
      const url = 'https://www.indeed.com/companies/search?q=' + encodeURIComponent(name);
      const r = await indeedFetch(url);
      if (!r || r.error) return { status: 'unknown', source: 'indeed', reason: r && r.error };
      if (r.challenge || r.status === 403) return { status: 'blocked', source: 'indeed' };
      const companies = parseIndeedCompanies(r.text || '');
      const best = bestCompanyMatch(companies, name);
      if (best) return { status: 'found', source: 'indeed', rating: best.rating, count: best.count, url: best.url };
      return { status: 'not_found', source: 'indeed' };
    } catch (e) { return { status: 'unknown', source: 'indeed', reason: String(e && e.message || e) }; }
  }

  async function glassdoorCompany(name, fetchDirect, fetchViaTab) {
    async function get(url) {
      let r = null;
      try { r = await fetchDirect(url); } catch { r = null; }
      if (!r || !r.ok || r.status === 403 || /just a moment|captcha|cf-challenge/i.test(String(r.text || '').slice(0, 3000))) {
        if (fetchViaTab) { try { r = await fetchViaTab(url); } catch { } }
      }
      return r;
    }
    try {
      const findUrl = 'https://www.glassdoor.com/api-web/employer/find.htm?autocomplete=true&maxEmployersForAutocomplete=10&term=' + encodeURIComponent(name);
      const fr = await get(findUrl);
      if (!fr || (!fr.ok && fr.status === 403)) return { status: 'blocked', source: 'glassdoor' };
      const found = parseGlassdoorFind(fr && fr.text);
      if (!found.length) return { status: 'not_found', source: 'glassdoor' };
      const t = norm(name);
      let pick = null, pickTier = 0;
      for (const f of found) { const tier = nameMatch(norm(f.label), t); if (tier > pickTier) { pick = f; pickTier = tier; } }
      if (!pick) return { status: 'not_found', source: 'glassdoor' };
      const revUrl = glassdoorReviewsUrl(pick.label, pick.id);
      const rr = await get(revUrl);
      if (!rr) return { status: 'unknown', source: 'glassdoor' };
      if (rr.status === 403 || rr.challenge) return { status: 'blocked', source: 'glassdoor' };
      const { rating, count } = parseGlassdoorRating(rr.text || '');
      if (rating != null) return { status: 'found', source: 'glassdoor', rating, count, url: revUrl };
      return { status: 'not_found', source: 'glassdoor', url: revUrl };
    } catch (e) { return { status: 'unknown', source: 'glassdoor', reason: String(e && e.message || e) }; }
  }

  async function levelsCompany(name, fetchDirect) {
    try {
      const slug = String(name || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      if (!slug) return { status: 'not_found', source: 'levels' };
      const r = await fetchDirect('https://www.levels.fyi/companies/' + slug + '/salaries');
      if (!r || !r.ok) return { status: 'unknown', source: 'levels' };
      const { median } = parseLevels(r.text || '');
      if (median) return { status: 'found', source: 'levels', median, url: 'https://www.levels.fyi/companies/' + slug + '/salaries' };
      return { status: 'not_found', source: 'levels' };
    } catch (e) { return { status: 'unknown', source: 'levels', reason: String(e && e.message || e) }; }
  }

  globalThis.HCX_RATINGS = {
    parseIndeedCompanies, bestCompanyMatch, parseGlassdoorFind, parseGlassdoorRating,
    glassdoorReviewsUrl, parseLevels, indeedCompany, glassdoorCompany, levelsCompany
  };
})();
