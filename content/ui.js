(() => {
  'use strict';
  const HCX = window.HCX;
  if (!HCX || HCX._uiLoaded) return;
  HCX._uiLoaded = true;

  const { state } = HCX;
  const { el, toast } = HCX.util;
  const S = () => state.settings;

  function orderedCards() {

    return [...state.cards.values()]
      .filter(c => c.root.isConnected && (c.surface === 'grid' || c.surface === 'synthetic') &&
        !['hcx-hidden-collapsed', 'hcx-dupe-collapsed', 'hcx-filtered', 'hcx-blocked'].some(cl => c.root.classList.contains(cl)))
      .map(c => ({ c, r: c.root.getBoundingClientRect() }))
      .sort((a, b) => (Math.abs(a.r.top - b.r.top) < 8 ? a.r.left - b.r.left : a.r.top - b.r.top))
      .map(x => x.c);
  }

  const CHEV_L = 'M15.75 19.5L8.25 12l7.5-7.5', CHEV_R = 'M8.25 4.5l7.5 7.5-7.5 7.5';
  function moveCarousel(ctl, dir) {
    if (!ctl) return false;
    const cands = [...ctl.root.querySelectorAll(':scope button')].filter(b => /bg-gray-200/.test(String(b.className)) && /md:bg-white\/0/.test(String(b.className)));
    let prev = null, next = null;
    for (const b of cands) { const d = b.querySelector('svg path')?.getAttribute('d'); if (d === CHEV_L) prev = b; else if (d === CHEV_R) next = b; }
    if (!prev && !next && cands.length >= 2) { prev = cands[0]; next = cands[cands.length - 1]; }
    const btn = dir < 0 ? prev : next;
    if (btn && !btn.disabled) { btn.click(); return true; }
    return false;
  }
  function focusedCtl() { return state.focusSlug ? state.cards.get(state.focusSlug) : null; }
  function setFocus(ctl) {
    focusedCtl()?.root.classList.remove('hcx-focus');
    state.focusSlug = ctl?.slug || null;
    if (ctl) { ctl.root.classList.add('hcx-focus'); ctl.root.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
  }
  HCX.setFocus = setFocus;
  function moveFocus(dir) {
    const cards = orderedCards(); if (!cards.length) return;
    const idx = cards.findIndex(c => c.slug === state.focusSlug);
    const next = idx === -1 ? (dir > 0 ? cards[0] : cards[cards.length - 1]) : cards[Math.max(0, Math.min(cards.length - 1, idx + dir))];
    setFocus(next);
  }
  function openProvider(ctl, provider) {
    const r = ctl.results[provider];
    const q = encodeURIComponent(ctl.job.title + ' ' + ctl.job.company);
    const url = r?.status === 'found' ? r.url : (provider === 'linkedin'
      ? `https://www.linkedin.com/jobs/search/?keywords=${q}` : `https://www.indeed.com/jobs?q=${q}`);
    window.open(url, '_blank', 'noopener');
  }
  function openGlassdoor(ctl) {
    if (ctl.rating?.status === 'found' && ctl.rating.url) window.open(ctl.rating.url, '_blank', 'noopener');
    else window.open('https://www.glassdoor.com/Search/results.htm?keyword=' + encodeURIComponent(ctl.job.company), '_blank', 'noopener');
  }

  const SHORTCUTS = [
    ['j / k  (or ↑ / ↓)', 'next / previous company card'],
    ['← / →', 'page this company’s jobs (carousel)'],
    ['o  or  Enter', 'open the job / apply link'],
    ['l / i / g', 'open on LinkedIn / Indeed / Glassdoor'],
    ['a', 'mark applied'],
    ['r', 'report job'],
    ['n', 'add or edit a note'],
    ['b', 'block this company'],
    ['⌘/Ctrl-K  or  .', 'command palette'],
    ['?', 'toggle this help'],
    ['Esc', 'close / clear focus']
  ];
  let helpOverlay = null;
  function toggleHelp() {
    if (helpOverlay) { helpOverlay.remove(); helpOverlay = null; return; }
    helpOverlay = el('div', { class: 'hcx-help', onclick: () => toggleHelp() });
    const box = el('div', { class: 'hcx-help-box', onclick: e => e.stopPropagation() });
    box.appendChild(el('h3', { text: 'HiringCafe+ shortcuts' }));
    const table = el('table');
    for (const [k, d] of SHORTCUTS) table.appendChild(el('tr', {}, el('td', { text: k }), el('td', { text: d })));
    box.appendChild(table);
    box.appendChild(el('div', { class: 'hcx-help-foot', text: 'Tip: open the ⚙ popup for settings, stats & export.' }));
    helpOverlay.appendChild(box);
    document.body.appendChild(helpOverlay);
  }

  function ensureHint() {
    if (!S().keyboard || !S().keyboardHints) { document.querySelector('.hcx-hint')?.remove(); return; }
    if (document.querySelector('.hcx-hint')) return;
    if (localStorage.getItem('hcxHintDismissed') === '1') return;
    const hint = el('div', { class: 'hcx-hint' },
      el('span', { text: 'HiringCafe+ · press ' }), el('b', { text: '?' }), el('span', { text: ' for shortcuts · ' }), el('b', { text: '.' }), el('span', { text: ' for commands' }),
      el('button', { class: 'hcx-hint-x', title: 'Dismiss', text: '×', onclick: () => { localStorage.setItem('hcxHintDismissed', '1'); hint.remove(); } }));
    document.body.appendChild(hint);
    HCX.util.makeDraggable(hint, 'hint');
    setTimeout(() => hint.classList.add('hcx-hint-dim'), 8000);
  }

  function editNote(ctl) {
    document.querySelector('.hcx-note-modal')?.remove();
    const ta = el('textarea', { class: 'hcx-note-ta', placeholder: 'Private note for this job…' });
    ta.value = HCX.util.noteText(state.notes[ctl.slug]);
    const modal = el('div', { class: 'hcx-note-modal', onclick: e => { if (e.target === modal) modal.remove(); } });
    const save = () => {
      const v = ta.value.trim();
      if (v) state.notes[ctl.slug] = { text: v, t: Date.now() }; else delete state.notes[ctl.slug];
      HCX.storage.saveNotes(); HCX.redecorate(ctl); modal.remove();
    };

    ta.addEventListener('keydown', e => {
      if (e.key === 'Escape') { modal.remove(); e.preventDefault(); }
      else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { save(); e.preventDefault(); }
      e.stopPropagation();
    });
    const box = el('div', { class: 'hcx-note-box' },
      el('div', { class: 'hcx-note-title', text: '🗒 ' + (ctl.job.title || 'Note') + ' — ' + (ctl.job.company || '') }),
      ta,
      el('div', { class: 'hcx-note-actions' },
        el('button', { class: 'hcx-note-save', text: 'Save', onclick: save }),
        el('button', { text: 'Cancel', onclick: () => modal.remove() })));
    modal.appendChild(box); document.body.appendChild(modal); ta.focus();
  }
  HCX.editNote = editNote;

  function baseActions() {
    const ctl = focusedCtl();
    const acts = [
      { name: 'Sort by company rating', run: () => setSort('rating') },
      { name: 'Sort by salary (high→low)', run: () => setSort('salary_desc') },
      { name: 'Sort by newest', run: () => setSort('newest') },
      { name: 'Sort by company size', run: () => setSort('company_size') },
      { name: 'Clear sort', run: () => setSort('default') },
      { name: 'Filter: only jobs on neither LinkedIn nor Indeed (💎 Gems)', run: () => setFilter('neither') },
      { name: 'Filter: reset (All)', run: () => setFilter('all') },
      { name: 'Show / hide help', run: toggleHelp },
      { name: '⬇ Export jobs…', run: () => HCX.openExport() },
      { name: 'Mark all visible new jobs as seen', run: markAllSeen },
      { name: '🔔 Watch this search for new jobs (alerts)', run: watchThisSearch }
    ];
    if (ctl) {
      acts.unshift(
        { name: '✓ Applied — ' + ctl.job.title, run: () => HCX.setMark(ctl, 'a') },
        { name: '🚩 Report — ' + ctl.job.title, run: () => HCX.reportFocused(ctl) },
        { name: '🗒 Note — ' + ctl.job.title, run: () => editNote(ctl) },
        { name: '🚫 Block company — ' + ctl.job.company, run: () => blockCompany(ctl.job.company) }
      );
    }
    for (const a of (HCX.actions || [])) acts.push(a);
    return acts;
  }
  function jobActions() {
    return orderedCards().slice(0, 200).map(c => ({ name: '→ ' + c.job.title + '  ·  ' + c.job.company, run: () => setFocus(c) }));
  }

  let palette = null;
  function openPalette() {
    if (palette) { closePalette(); return; }
    const input = el('input', { class: 'hcx-pal-input', placeholder: 'Type a command or job title…' });
    const list = el('div', { class: 'hcx-pal-list' });
    palette = el('div', { class: 'hcx-pal', onclick: e => { if (e.target === palette) closePalette(); } });
    palette.appendChild(el('div', { class: 'hcx-pal-box' }, input, list));
    document.body.appendChild(palette);
    const all = () => baseActions().concat(jobActions());
    let items = all(), sel = 0;
    const render = () => {
      const q = input.value.toLowerCase().trim();
      items = (q ? all().filter(a => a.name.toLowerCase().includes(q)) : all()).slice(0, 40);
      sel = Math.min(sel, Math.max(0, items.length - 1));
      list.textContent = '';
      items.forEach((a, i) => list.appendChild(el('div', { class: 'hcx-pal-item' + (i === sel ? ' hcx-pal-sel' : ''), text: a.name, onclick: () => { a.run(); closePalette(); } })));
    };
    input.addEventListener('input', render);
    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { sel = Math.min(items.length - 1, sel + 1); render(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); render(); e.preventDefault(); }
      else if (e.key === 'Enter') { items[sel]?.run(); closePalette(); e.preventDefault(); }
      else if (e.key === 'Escape') { closePalette(); e.preventDefault(); }
      e.stopPropagation();
    });
    render(); input.focus();
  }
  function closePalette() { palette?.remove(); palette = null; }

  async function persist(patch) { try { const { settings = {} } = await chrome.storage.local.get('settings'); Object.assign(settings, patch); await chrome.storage.local.set({ settings }); } catch { } }
  function setSort(v) { S().sortMode = v; HCX.applyFilterAll(); persist({ sortMode: v }); }
  function setFilter(v) { S().filterMode = v; HCX.applyFilterAll(); persist({ filterMode: v }); }
  function markAllSeen() { for (const c of orderedCards()) { if (!state.seenSnapshot.has(c.slug)) { HCX.queueSeen(c.slug); state.seenSnapshot.add(c.slug); c.root.querySelector(':scope .hcx-new')?.remove(); if (S().dimSeen) c.root.classList.add('hcx-seen'); } } HCX.updateDigest(); toast('Marked all visible jobs as seen'); }
  async function blockCompany(name) {
    if (!name) return;
    try {
      const { blocklists = {} } = await chrome.storage.local.get('blocklists');
      const bl = { ...HCX.DEFAULT_BLOCKLISTS, ...blocklists };
      if (!bl.companies.includes(name)) bl.companies.push(name);
      await chrome.storage.local.set({ blocklists: bl });
      toast('Blocked ' + name, { action: { label: 'Undo', fn: async () => { bl.companies = bl.companies.filter(c => c !== name); await chrome.storage.local.set({ blocklists: bl }); } } });
    } catch { }
  }
  HCX.blockCompany = blockCompany;

  async function hideCompanyForever(name, on = true) {
    const co = String(name || '').trim();
    if (!co) return false;
    let data = {};
    try { ({ filters: data = {} } = await chrome.storage.local.get('filters')); } catch { }
    const f = { presets: { ...(data.presets || {}) }, custom: [...(data.custom || [])], accountWide: !!data.accountWide };
    const same = c => c.field === 'company' && String(c.value || '').trim().toLowerCase() === co.toLowerCase();
    const had = f.custom.some(same);
    if (on === had) return true;
    if (on) f.custom.push({ field: 'company', op: 'contains', value: co });
    else f.custom = f.custom.filter(c => !same(c));
    await saveFiltersState(f);
    state.autoHide = { rules: compileFilters(f), accountWide: !!f.accountWide };
    if (HCX.rebuildAutoHide) HCX.rebuildAutoHide();
    return true;
  }
  HCX.hideCompanyForever = hideCompanyForever;

  async function watchThisSearch() {
    const stateStr = HCX.pager?.searchStateStr || '{}';
    let label = 'Search';
    try { const q = JSON.parse(stateStr); label = q.searchQuery || q.searchText || 'Search'; } catch { }
    try {
      if (!S().alerts) { S().alerts = true; await persist({ alerts: true }); }
      const { alertWatches = [] } = await chrome.storage.local.get('alertWatches');
      if (alertWatches.some(w => w.state === stateStr)) { toast('Already watching this search'); return; }
      alertWatches.push({ state: stateStr, label, seen: [], initialized: false, t: Date.now() });
      await chrome.storage.local.set({ alertWatches });
      chrome.runtime.sendMessage({ type: 'HCX_POLL_NOW' }).catch(() => { });
      toast('🔔 Watching “' + label + '” — you’ll get a notification on new matches');
    } catch { toast('Could not save the watch'); }
  }

  function onKeydown(e) {
    if (HCX.isInternalPage && HCX.isInternalPage()) return;
    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) { openPalette(); e.preventDefault(); return; }
    if (!S().keyboard) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    const ctl = focusedCtl();

    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    switch (k) {
      case 'j': case 'ArrowDown': moveFocus(1); break;
      case 'k': case 'ArrowUp': moveFocus(-1); break;
      case 'ArrowLeft': if (!ctl || !moveCarousel(ctl, -1)) return; break;
      case 'ArrowRight': if (!ctl || !moveCarousel(ctl, 1)) return; break;
      case 'o': case 'Enter': if (!ctl) return; window.open(ctl.applyUrl || ctl.openUrl, '_blank', 'noopener'); break;
      case 'l': if (ctl) openProvider(ctl, 'linkedin'); else return; break;
      case 'i': if (ctl) openProvider(ctl, 'indeed'); else return; break;
      case 'g': if (ctl) openGlassdoor(ctl); else return; break;
      case 'a': if (ctl) HCX.setMark(ctl, 'a'); else return; break;
      case 'r': if (ctl) HCX.reportFocused(ctl); else return; break;
      case 'n': if (ctl) editNote(ctl); else return; break;
      case 'b': if (ctl) blockCompany(ctl.job.company); else return; break;
      case '.': openPalette(); break;
      case '?': toggleHelp(); break;
      case 'Escape': if (palette) closePalette(); else if (helpOverlay) toggleHelp(); else setFocus(null); break;
      default: return;
    }
    e.preventDefault(); e.stopPropagation();
  }

  function loadedCtls() {
    return [...state.cards.values()].filter(c => c.surface === 'grid' && c.root.isConnected)
      .sort((a, b) => a.root.compareDocumentPosition(b.root) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1);
  }
  function visibleCtls() {
    return loadedCtls().filter(c => !['hcx-filtered', 'hcx-blocked', 'hcx-hidden-collapsed', 'hcx-dupe-collapsed'].some(cl => c.root.classList.contains(cl)));
  }
  function rowFromCtl(ctl) {
    const hit = ctl.hit || null;
    const v5 = (hit && hit.v5_processed_job_data) || {};
    const co = HCX.coData(hit);
    const mark = state.marks[ctl.slug];
    const url = (hit && hit.apply_url) || ctl.applyUrl || '';
    const ats = (globalThis.HCX_DATA && url) ? globalThis.HCX_DATA.atsInfo(url) : null;
    return {
      status: mark ? { i: 'interested', a: 'applied', x: 'hidden' }[mark.s] : '',
      title: ctl.job.title, company: ctl.job.company, location: ctl.job.location,
      salary_yr: HCX.fmtSalaryYr ? (HCX.fmtSalaryYr(v5) || '') : '',
      workplace_type: v5.workplace_type || '', seniority: v5.seniority_level || '',
      min_yoe: v5.min_industry_and_role_yoe ?? '',
      visa: v5.visa_sponsorship === true ? 'yes' : v5.visa_sponsorship === false ? 'no' : '',
      source: (hit && hit.source) || '', ats: ats ? ats.name : '',
      company_size: co.nb_employees || '', founded: co.year_founded || '',
      rating: ctl.rating && ctl.rating.status === 'found' ? ctl.rating.rating : '',
      rating_source: ctl.rating && ctl.rating.status === 'found' ? ctl.rating.source : '',
      apply_url: url, note: HCX.util.noteText(state.notes[ctl.slug])
    };
  }

  function rowsForCtl(ctl) {
    const ck = ctl.hit && ctl.hit.collapse_key;
    const group = (ck && HCX.data && HCX.data.groupHits) ? HCX.data.groupHits(ck) : [];
    if (group && group.length > 1) return group.map(rowFromHit);
    return [rowFromCtl(ctl)];
  }
  function rowFromMark(slug, m) {
    return {
      status: { i: 'interested', a: 'applied', x: 'hidden' }[m.s] || m.s,
      title: m.title || '', company: m.company || '', location: m.location || '',
      salary_yr: '', workplace_type: '', seniority: '', min_yoe: '', visa: '',
      source: '', ats: '', company_size: '', founded: '', rating: '', rating_source: '',
      apply_url: m.url || (slug.startsWith('/job/') ? 'https://hiringcafe.com' + slug : ''),
      note: HCX.util.noteText(state.notes[slug])
    };
  }
  async function fetchAllPages(onProgress) {
    const hits = []; const bid = HCX.pager.buildId; const st = HCX.pager.searchStateStr || '{}';
    if (!bid) return hits;
    for (let page = 1; page <= 25; page++) {
      onProgress && onProgress(page, hits.length);
      let res; try { res = await fetch(`/_next/data/${bid}/index.json?searchState=` + encodeURIComponent(st) + '&page=' + page, { credentials: 'include' }); } catch { break; }
      if (!res.ok) break;
      const pp = (await res.json()).pageProps || {};
      const pageHits = (pp.ssrHits || []).filter(h => !h.is_hc_pinned);
      hits.push(...pageHits);
      if (pp.ssrIsLastPage || !pageHits.length) break;
    }
    return hits;
  }
  function rowFromHit(hit) {
    const id = hit.objectID || hit.id;
    const existing = state.cards.get('/hcx/' + id) || [...state.cards.values()].find(c => c.hit && String(c.hit.objectID || c.hit.id) === String(id));
    if (existing) return rowFromCtl(existing);

    const v5 = hit.v5_processed_job_data || {}, co = HCX.coData(hit);
    const url = hit.apply_url || '';
    const ats = (globalThis.HCX_DATA && url) ? globalThis.HCX_DATA.atsInfo(url) : null;
    return {
      status: '', title: v5.core_job_title || '', company: v5.company_name || co.name || '',
      location: v5.formatted_workplace_location || '', salary_yr: HCX.fmtSalaryYr ? (HCX.fmtSalaryYr(v5) || '') : '',
      workplace_type: v5.workplace_type || '', seniority: v5.seniority_level || '', min_yoe: v5.min_industry_and_role_yoe ?? '',
      visa: v5.visa_sponsorship === true ? 'yes' : v5.visa_sponsorship === false ? 'no' : '',
      source: hit.source || '', ats: ats ? ats.name : '', company_size: co.nb_employees || '', founded: co.year_founded || '',
      rating: '', rating_source: '', apply_url: url, note: ''
    };
  }
  function csvEscape(v) { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
  function download(name, text, type) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = el('a', { href: url, download: name }); document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
  function serialize(rows, fmt) {
    if (fmt === 'json') return JSON.stringify(rows, null, 2);
    if (!rows.length) return '';
    const cols = Object.keys(rows[0]);
    return [cols.join(','), ...rows.map(r => cols.map(c => csvEscape(r[c])).join(','))].join('\r\n');
  }

  function openExportWindow() {
    document.querySelector('.hcx-export-modal')?.remove();
    const modal = el('div', { class: 'hcx-export-modal', onclick: e => { if (e.target === modal) modal.remove(); } });
    const scopeSel = el('select', { class: 'hcx-exp-scope' });
    [['selected', 'Selected jobs (tick below)'], ['visible', 'Everything visible on this page'], ['loaded', 'All jobs loaded on this page'],
     ['search', 'Everything in this search (all pages)'], ['marked', 'Marked jobs (★ interested / ✓ applied / ✕ hidden)']]
      .forEach(([v, l]) => scopeSel.appendChild(el('option', { value: v, text: l })));
    const fmtSel = el('select', { class: 'hcx-exp-fmt' });
    fmtSel.append(el('option', { value: 'csv', text: 'CSV' }), el('option', { value: 'json', text: 'JSON' }));

    const list = el('div', { class: 'hcx-exp-list' });
    const buildList = () => {
      list.textContent = '';
      const ctls = loadedCtls();
      if (!ctls.length) { list.appendChild(el('div', { class: 'hcx-exp-empty', text: 'No jobs loaded on this page.' })); return; }
      for (const c of ctls) {
        const cb = el('input', { type: 'checkbox', checked: 'checked' }); cb.checked = true; cb.dataset.slug = c.slug;
        list.appendChild(el('label', { class: 'hcx-exp-item' }, cb, el('span', { text: (c.job.title || '(untitled)') + '  —  ' + (c.job.company || '?') })));
      }
    };
    buildList();
    const selectRow = el('div', { class: 'hcx-exp-selrow' },
      el('button', { type: 'button', text: 'All', onclick: () => list.querySelectorAll('input').forEach(i => i.checked = true) }),
      el('button', { type: 'button', text: 'None', onclick: () => list.querySelectorAll('input').forEach(i => i.checked = false) }));
    const listWrap = el('div', { class: 'hcx-exp-listwrap' }, selectRow, list);
    const status = el('div', { class: 'hcx-exp-status' });
    scopeSel.addEventListener('change', () => { listWrap.style.display = scopeSel.value === 'selected' ? 'block' : 'none'; });
    listWrap.style.display = 'block';

    const doExport = async () => {
      const scope = scopeSel.value, fmt = fmtSel.value;
      let rows = [];
      try {
        if (scope === 'selected') {
          const slugs = new Set([...list.querySelectorAll('input:checked')].map(i => i.dataset.slug));
          rows = loadedCtls().filter(c => slugs.has(c.slug)).flatMap(rowsForCtl);
        } else if (scope === 'visible') rows = visibleCtls().flatMap(rowsForCtl);
        else if (scope === 'loaded') rows = loadedCtls().flatMap(rowsForCtl);
        else if (scope === 'marked') rows = Object.entries(state.marks).map(([slug, m]) => rowFromMark(slug, m));
        else if (scope === 'search') {
          status.textContent = 'Fetching all pages…';
          const hits = await fetchAllPages((p, n) => { status.textContent = `Fetching page ${p}… (${n} jobs so far)`; });
          rows = hits.map(rowFromHit);
        }
      } catch (e) { status.textContent = 'Export failed: ' + (e && e.message || e); return; }
      if (!rows.length) { status.textContent = 'Nothing to export for that scope.'; return; }
      const stamp = (HCX.pager.searchStateStr && HCX.pager.searchStateStr !== '{}') ? 'search' : 'jobs';
      download('hiringcafe-' + stamp + '.' + fmt, serialize(rows, fmt), fmt === 'json' ? 'application/json' : 'text/csv');
      status.textContent = `Exported ${rows.length} job${rows.length === 1 ? '' : 's'} as ${fmt.toUpperCase()}.`;
      toast(`Exported ${rows.length} jobs`);
    };

    const box = el('div', { class: 'hcx-exp-box', onclick: e => e.stopPropagation() },
      el('div', { class: 'hcx-exp-title', text: '⬇ Export jobs' }),
      el('div', { class: 'hcx-exp-row' }, el('span', { text: 'What' }), scopeSel),
      el('div', { class: 'hcx-exp-row' }, el('span', { text: 'Format' }), fmtSel),
      listWrap,
      el('div', { class: 'hcx-exp-actions' },
        el('button', { class: 'hcx-exp-go', text: 'Export', onclick: doExport }),
        el('button', { text: 'Close', onclick: () => modal.remove() })),
      status);
    modal.appendChild(box); document.body.appendChild(modal);
  }
  HCX.openExport = openExportWindow;

  const ACCOUNT_HIDE_CAP = 40;
  async function getCreds() {
    try {
      const db = await new Promise((res, rej) => { const r = indexedDB.open('firebaseLocalStorageDb'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
      const store = [...db.objectStoreNames][0];
      const rows = await new Promise((res, rej) => { const r = db.transaction(store, 'readonly').objectStore(store).getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
      db.close();
      const row = rows.find(r => r.value && r.value.stsTokenManager);
      if (!row) return null;
      const v = row.value;
      return { uid: v.uid, token: v.stsTokenManager.accessToken, refreshToken: v.stsTokenManager.refreshToken, apiKey: v.apiKey, expMs: +v.stsTokenManager.expirationTime || 0, email: v.email || '', name: v.displayName || '' };
    } catch { return null; }
  }
  async function accountHide(matches) {
    let creds = await getCreds();
    if (!creds || !creds.token) throw new Error('Not signed in to HiringCafe');
    if (!creds.expMs || Date.now() > creds.expMs - 120000) {
      const r = await chrome.runtime.sendMessage({ type: 'HCX_REFRESH_TOKEN', refreshToken: creds.refreshToken, apiKey: creds.apiKey });
      if (r && r.token) { creds.token = r.token; if (r.uid) creds.uid = r.uid; }
      else if (r && r.error) throw new Error('Could not refresh your login (' + r.error + ')');
    }
    const { accountHidden = [] } = await chrome.storage.local.get('accountHidden');
    const already = new Set(accountHidden.map(x => x.id));
    const todo = [];
    for (const c of matches) {
      const id = c.hit && String(c.hit.objectID || c.hit.id);
      if (!id || already.has(id)) continue;
      if (state.marks[c.slug]?.s === 'a') continue;
      todo.push({ id, title: c.job.title, company: c.job.company });
      if (todo.length >= ACCOUNT_HIDE_CAP) break;
    }
    let n = 0;
    for (const job of todo) {
      try {
        const fs = await chrome.runtime.sendMessage({ type: 'HCX_FS_HIDE', token: creds.token, uid: creds.uid, id: job.id });
        if (!fs || !fs.ok) continue;
        await fetch('/api/updateMarketplaceJobStageForUser', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ job_id: job.id, user_token: creds.token }) }).catch(() => { });
        accountHidden.push({ id: job.id, at: Date.now(), title: job.title, company: job.company });
        n++;
      } catch { }
      await new Promise(r => setTimeout(r, 400));
    }
    try { await chrome.storage.local.set({ accountHidden: accountHidden.slice(-1000) }); } catch { }
    return n;
  }
  HCX.accountHide = accountHide;

  async function accountMark(hit, type) {
    if (!hit) return false;
    const saveType = String(type || '').toLowerCase();
    let creds = await getCreds();
    if (!creds || !creds.token) { toast('Sign in to HiringCafe to use your account'); return false; }
    if (!creds.expMs || Date.now() > creds.expMs - 120000) {
      const r = await chrome.runtime.sendMessage({ type: 'HCX_REFRESH_TOKEN', refreshToken: creds.refreshToken, apiKey: creds.apiKey });
      if (r && r.token) { creds.token = r.token; if (r.uid) creds.uid = r.uid; }
    }
    const id = String(hit.objectID || hit.id || '');
    try {
      const fs = await chrome.runtime.sendMessage({ type: 'HCX_FS_SAVE', token: creds.token, uid: creds.uid, hit, saveType });
      if (!fs || !fs.ok) { toast('Could not ' + (saveType === 'saved' ? 'save' : saveType === 'applied' ? 'mark applied' : 'update') + (fs && fs.error ? ' (' + String(fs.error).slice(0, 60) + ')' : '')); return false; }
      fetch('/api/updateMarketplaceJobStageForUser', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ job_id: id, user_token: creds.token }) }).catch(() => { });
      toast(saveType === 'saved' ? '★ Saved to your account' : saveType === 'applied' ? '✓ Applied — saved to your account' : 'Updated in your account');
      return true;
    } catch (e) { toast('Account write failed: ' + (e && e.message || e)); return false; }
  }
  HCX.accountMark = accountMark;

  function confirmModal(msg, opts = {}) {
    return new Promise(resolve => {
      const done = v => { m.remove(); document.removeEventListener('keydown', onKey, true); resolve(v); };
      const onKey = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(false); } };
      const m = el('div', { class: 'hcx-note-modal', onclick: e => { if (e.target === m) done(false); } });
      m.appendChild(el('div', { class: 'hcx-note-box' },
        el('div', { class: 'hcx-note-title', text: opts.title || 'Confirm' }),
        el('div', { style: 'font-size:13px;line-height:1.4;margin-bottom:12px', text: msg }),
        el('div', { class: 'hcx-note-actions' },
          el('button', { class: 'hcx-note-save' + (opts.danger ? ' hcx-note-danger' : ''), text: opts.ok || 'Confirm', onclick: () => done(true) }),
          el('button', { text: 'Cancel', onclick: () => done(false) }))));
      document.body.appendChild(m);
      document.addEventListener('keydown', onKey, true);
    });
  }
  HCX.confirmModal = confirmModal;

  async function applyAccountAutohide() {
    try {
      if (HCX.rebuildAutoHide) HCX.rebuildAutoHide();
      const seen = new Set();
      const matches = [...state.cards.values()].filter(c => {
        if (!((c.surface === 'grid' || c.surface === 'synthetic') && c.hit && HCX.matchesAutoHide && HCX.matchesAutoHide(c))) return false;
        const id = String(c.hit.objectID || c.hit.id); if (seen.has(id)) return false; seen.add(id); return true;
      });
      if (!matches.length) return { ok: true, message: 'No jobs on this page match your filters.' };
      const ok = await confirmModal(`Hide ${Math.min(matches.length, ACCOUNT_HIDE_CAP)} job(s) in your real HiringCafe account? This writes across all your devices (reversible via the site’s Hidden list). Up to ${ACCOUNT_HIDE_CAP} per run.`, { ok: 'Hide in my account', danger: true });
      if (!ok) return { ok: true, message: 'Cancelled — nothing written. (Local hide still active.)' };
      const n = await accountHide(matches);
      return { ok: true, message: `Hid ${n} job(s) in your account. Scroll to load more, then run again.` };
    } catch (e) { return { ok: false, message: 'Failed: ' + (e && e.message || e) }; }
  }

  const FLT_PRESETS = [
    { key: 'agency', label: '🕵 Staffing agencies', rule: 'agency' },
    { key: 'mlm', label: '🔺 MLMs', rule: 'mlm' },
    { key: 'aicompany', label: '🤖 AI companies', rule: 'ai company' },
    { key: 'stale', label: '🕰 Stale / reposted', rule: 'stale' },
    { key: 'novisa', label: '🛂 No visa sponsorship', rule: 'no visa' },
    { key: 'clearance', label: '🔒 Requires clearance', rule: 'clearance' },
    { key: 'notremote', label: '🏢 Not remote', rule: 'not remote' }
  ];
  const NUMOPS = [['lt', '<'], ['gt', '>'], ['eq', '=']];
  const FLT_FIELDS = [
    { key: 'company', label: 'Company', ops: [['contains', 'contains']], val: 'text', ph: 'Acme Corp' },
    { key: 'title', label: 'Title', ops: [['contains', 'contains']], val: 'text', ph: 'senior' },
    { key: 'keyword', label: 'Keyword', ops: [['contains', 'in title or company']], val: 'text', ph: 'commission only' },
    { key: 'location', label: 'Location', ops: [['contains', 'contains']], val: 'text', ph: 'India' },
    { key: 'salary', label: 'Salary', ops: NUMOPS, val: 'salary' },
    { key: 'size', label: 'Company size', ops: NUMOPS, val: 'num', suf: 'employees', ph: '50' },
    { key: 'yoe', label: 'Experience', ops: NUMOPS, val: 'num', suf: 'yrs', ph: '5' },
    { key: 'founded', label: 'Founded (year)', ops: NUMOPS, val: 'year', ph: '2015' },
    { key: 'ats', label: 'ATS', ops: [['is', 'is']], val: 'ats', ph: 'workday' }
  ];
  const FLT_ATS = ['workday', 'greenhouse', 'lever', 'icims', 'taleo', 'successfactors', 'ashby', 'smartrecruiters', 'jobvite', 'bamboohr', 'breezy'];
  const OPSYM = { lt: '<', gt: '>', eq: '=', below: '<', above: '>' };
  function compileFilters(f) {
    const rules = [];
    for (const p of FLT_PRESETS) if (f.presets && f.presets[p.key]) rules.push(p.rule);
    for (const c of (f.custom || [])) {
      const v = String(c.value || '').trim(); if (!v) continue;
      const num = v.replace(/[^\d.]/g, ''); const sym = OPSYM[c.op] || '<';
      if (c.field === 'salary') rules.push('salary ' + sym + ' ' + num + 'k');
      else if (c.field === 'size' || c.field === 'yoe' || c.field === 'founded') { if (num) rules.push(c.field + ' ' + sym + ' ' + num); }
      else if (c.field === 'ats') rules.push('ats: ' + v.toLowerCase());
      else if (['title', 'company', 'location', 'keyword'].includes(c.field)) rules.push(c.field + ': ' + v);
    }
    return rules;
  }
  async function saveFiltersState(f) {
    try { await chrome.storage.local.set({ filters: f, autoHide: { rules: compileFilters(f), accountWide: !!f.accountWide } }); } catch { }
  }
  let filtersPanel = null;
  async function openFiltersPanel() {
    if (filtersPanel) { filtersPanel.remove(); filtersPanel = null; return; }
    let data = {};
    try { ({ filters: data = {} } = await chrome.storage.local.get('filters')); } catch { }
    const f = { presets: { ...(data.presets || {}) }, custom: [...(data.custom || [])], accountWide: !!data.accountWide };
    const save = () => saveFiltersState(f);

    const presetsHost = el('div', { class: 'hcx-flt-presets' });
    for (const p of FLT_PRESETS) {
      const b = el('button', { type: 'button', class: 'hcx-flt-chip' + (f.presets[p.key] ? ' on' : ''), text: p.label });
      b.onclick = () => { f.presets[p.key] = !f.presets[p.key]; b.classList.toggle('on', !!f.presets[p.key]); save(); };
      presetsHost.appendChild(b);
    }
    const customHost = el('div', { class: 'hcx-flt-custom' });
    function rowEl(c, i) {
      const fieldSel = el('select', { class: 'hcx-flt-sel' });
      for (const F of FLT_FIELDS) fieldSel.appendChild(el('option', { value: F.key, text: F.label }));
      fieldSel.value = c.field || 'company';
      const opSel = el('select', { class: 'hcx-flt-sel' });
      const valWrap = el('span', { class: 'hcx-flt-valwrap' });
      const del = el('button', { type: 'button', class: 'hcx-flt-del', text: '✕', title: 'Remove' });
      del.onclick = () => { f.custom.splice(i, 1); renderCustom(); save(); };
      function buildVal(F) {
        valWrap.textContent = '';
        const inp = el('input', { class: 'hcx-flt-inp', value: c.value || '' });
        if (F.val === 'salary' || F.val === 'num' || F.val === 'year') {
          inp.type = 'number'; inp.min = '0'; inp.placeholder = F.val === 'salary' ? '70' : (F.ph || '0'); inp.classList.add('hcx-flt-num');
          inp.oninput = () => { c.value = inp.value; save(); };
          valWrap.append(inp);
          const suf = F.val === 'salary' ? 'k / yr' : F.suf;
          if (suf) valWrap.append(el('span', { class: 'hcx-flt-suf', text: suf }));
        } else {
          inp.placeholder = F.ph || 'text…'; if (F.val === 'ats') inp.setAttribute('list', 'hcx-flt-ats');
          inp.oninput = () => { c.value = inp.value; save(); }; valWrap.append(inp);
        }
      }
      function buildOps() {
        const F = FLT_FIELDS.find(x => x.key === fieldSel.value) || FLT_FIELDS[0];
        opSel.textContent = '';
        for (const [v, t] of F.ops) opSel.appendChild(el('option', { value: v, text: t }));
        if (F.ops.some(o => o[0] === c.op)) opSel.value = c.op; else { c.op = F.ops[0][0]; opSel.value = c.op; }
        opSel.style.display = F.ops.length > 1 ? '' : 'none'; buildVal(F);
      }
      fieldSel.onchange = () => { c.field = fieldSel.value; c.op = null; c.value = ''; buildOps(); save(); };
      opSel.onchange = () => { c.op = opSel.value; save(); };
      buildOps();
      return el('div', { class: 'hcx-flt-row' }, el('span', { class: 'hcx-flt-lead', text: 'Hide when' }), fieldSel, opSel, valWrap, del);
    }
    function renderCustom() {
      customHost.textContent = '';
      if (!f.custom.length) customHost.appendChild(el('div', { class: 'hcx-flt-empty', text: 'No custom filters yet.' }));
      f.custom.forEach((c, i) => customHost.appendChild(rowEl(c, i)));
    }
    renderCustom();
    const addBtn = el('button', { type: 'button', class: 'hcx-flt-add', text: '＋ Add a filter' });
    addBtn.onclick = () => { f.custom.push({ field: 'company', op: 'contains', value: '' }); renderCustom(); };
    const accCk = el('input', { type: 'checkbox' }); accCk.checked = !!f.accountWide;
    accCk.onchange = () => { f.accountWide = accCk.checked; save(); };
    const applyBtn = el('button', { type: 'button', class: 'hcx-flt-apply', text: 'Apply to my account now' });
    applyBtn.onclick = async () => { applyBtn.textContent = 'Applying…'; const r = await applyAccountAutohide(); applyBtn.textContent = 'Apply to my account now'; toast(r && r.message || 'Done'); };
    const atsList = el('datalist', { id: 'hcx-flt-ats' }); for (const a of FLT_ATS) atsList.appendChild(el('option', { value: a }));

    const box = el('div', { class: 'hcx-flt-box', onclick: e => e.stopPropagation() },
      el('div', { class: 'hcx-flt-titlebar' }, el('div', { class: 'hcx-flt-title', text: '⚙ Filters' }), el('button', { class: 'hcx-flt-x', text: '✕', onclick: () => { filtersPanel.remove(); filtersPanel = null; } })),
      el('div', { class: 'hcx-flt-note', text: 'Click to build filters — matching jobs are hidden from results.' }),
      el('div', { class: 'hcx-flt-sub', text: 'Quick filters' }), presetsHost,
      el('div', { class: 'hcx-flt-sub', text: 'Custom filters' }), customHost, addBtn, atsList,
      el('label', { class: 'hcx-flt-acc' }, accCk, el('span', { text: ' Also hide in my HiringCafe account' })), applyBtn);
    filtersPanel = el('div', { class: 'hcx-flt-modal', onclick: () => { filtersPanel.remove(); filtersPanel = null; } }, box);
    document.body.appendChild(filtersPanel);
  }
  HCX.openFilters = openFiltersPanel;

  async function migrateFiltersOnce() {
    try {
      const { filters, autoHide = {}, blocklists = {} } = await chrome.storage.local.get(['filters', 'autoHide', 'blocklists']);
      if (filters) return;
      const f = { presets: {}, custom: [], accountWide: !!autoHide.accountWide };
      for (const raw of (autoHide.rules || [])) {
        const s = String(raw || '').trim().toLowerCase(); if (!s || s.startsWith('#')) continue; let m;
        if (/no\s*visa|no\s*sponsor/.test(s)) f.presets.novisa = true;
        else if (/^mlm$/.test(s)) f.presets.mlm = true;
        else if (/^(agency|staffing|recruiter)$/.test(s)) f.presets.agency = true;
        else if (/^(stale|reposted|old|older)$/.test(s)) f.presets.stale = true;
        else if (/^(not\s*remote|onsite\s*only|no\s*remote)$/.test(s)) f.presets.notremote = true;
        else if (/clearance/.test(s) && !/:/.test(s)) f.presets.clearance = true;
        else if ((m = s.match(/salary\s*<\s*\$?\s*([\d.,]+)\s*k?/))) f.custom.push({ field: 'salary', op: 'below', value: m[1].replace(/,/g, '') });
        else if ((m = s.match(/salary\s*>\s*\$?\s*([\d.,]+)\s*k?/))) f.custom.push({ field: 'salary', op: 'above', value: m[1].replace(/,/g, '') });
        else if ((m = s.match(/^ats\s*:?\s*(.+)/))) f.custom.push({ field: 'ats', op: 'is', value: m[1].trim() });
        else if ((m = s.match(/^(title|company|location)\s*(?:contains\s*)?:?\s*(.+)/))) f.custom.push({ field: m[1], op: 'contains', value: m[2].trim() });
        else f.custom.push({ field: 'keyword', op: 'contains', value: s.replace(/^keyword\s*:?\s*/, '') });
      }
      for (const c of (blocklists.companies || [])) f.custom.push({ field: 'company', op: 'contains', value: c });
      for (const k of (blocklists.keywords || [])) f.custom.push({ field: 'keyword', op: 'contains', value: k });
      for (const l of (blocklists.locations || [])) f.custom.push({ field: 'location', op: 'contains', value: l });
      if (blocklists.useAgencies) f.presets.agency = true;
      if (blocklists.useMLM) f.presets.mlm = true;
      await chrome.storage.local.set({
        filters: f,
        autoHide: { rules: compileFilters(f), accountWide: f.accountWide },
        blocklists: { ...blocklists, companies: [], keywords: [], locations: [], useAgencies: false, useMLM: false }
      });
    } catch { }
  }

  document.addEventListener('keydown', onKeydown, true);
  HCX.hooks.onSettings.push(ensureHint);
  HCX.afterBoot(() => { ensureHint(); migrateFiltersOnce(); });

  HCX.boot();
})();
