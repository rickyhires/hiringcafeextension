const DEFAULTS = {
  linkedin: true, indeed: true, companyRatings: true,
  ratingsAutoTab: true, ratingSource: 'auto', companyIntel: true, atsBadge: true,
  showNew: true, dimSeen: true, ghostBadge: true, salaryNorm: true, salarySanity: true,
  companyCollapse: false, ungroupCarousels: false, compactView: false, digest: true,
  infiniteScroll: true, suppressPopups: false,
  sortMode: 'default', filterMode: 'all',
  alerts: false,
  keyboard: true, keyboardHints: true
};

const SECTIONS = [
  { title: 'Cross-check & ratings', items: [
    { key: 'linkedin', label: 'Check LinkedIn' },
    { key: 'indeed', label: 'Check Indeed' },
    { key: 'companyRatings', label: 'Show company ratings' },
    { key: 'ratingsAutoTab', label: 'Auto-load ratings via a hidden background tab' },
    { key: 'ratingSource', label: 'Rating source', type: 'select', opts: ['auto', 'glassdoor', 'indeed', 'levels'] }
  ]},
  { title: 'Company intel', items: [
    { key: 'companyIntel', label: 'Company size / funding / industry chips' },
    { key: 'atsBadge', label: 'ATS badge (Workday, Greenhouse…)' }
  ]},
  { title: 'Job signals', items: [
    { key: 'showNew', label: 'NEW badges' },
    { key: 'dimSeen', label: 'Dim already-seen jobs' },
    { key: 'ghostBadge', label: 'Flag stale / reposted jobs' },
    { key: 'salaryNorm', label: 'Normalize salary to yearly' },
    { key: 'salarySanity', label: 'Flag suspicious salary ranges' }
  ]},
  { title: 'Layout & view', items: [
    { key: 'compactView', label: 'Compact list view' },
    { key: 'digest', label: '“✨ new” digest button' },
    { key: 'infiniteScroll', label: 'Infinite scroll' },
    { key: 'companyCollapse', label: 'Collapse duplicate companies' },
    { key: 'ungroupCarousels', label: 'Ungroup company carousels' },
    { key: 'suppressPopups', label: 'Suppress site popups' },
    { key: 'sortMode', label: 'Sort by', type: 'select', opts: ['default', 'rating', 'salary_desc', 'salary_asc', 'newest', 'company_size'] },
    { key: 'filterMode', label: 'Provider filter', type: 'select', opts: ['all', 'not_linkedin', 'not_indeed', 'neither'] }
  ]},
  { title: 'Alerts', items: [
    { key: 'alerts', label: 'Saved-search alerts (notifications)' }
  ]},
  { title: 'Keyboard', items: [
    { key: 'keyboard', label: 'Keyboard shortcuts' },
    { key: 'keyboardHints', label: 'Show on-screen shortcut hint' }
  ]}
];

const SORT_LABELS = { default: 'Default', rating: 'Company rating', salary_desc: 'Salary ↓', salary_asc: 'Salary ↑', newest: 'Newest', company_size: 'Company size' };
const FILTER_LABELS = { all: 'All', not_linkedin: '∉ LinkedIn', not_indeed: '∉ Indeed', neither: '💎 Gems' };
const prettySel = (key, v) => key === 'sortMode' ? SORT_LABELS[v] : key === 'filterMode' ? FILTER_LABELS[v] : (v[0].toUpperCase() + v.slice(1));

let settings = { ...DEFAULTS };
async function saveSettings() { try { await chrome.storage.local.set({ settings }); } catch {} }
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

function renderSections() {
  const host = document.getElementById('sections');
  host.textContent = '';
  for (const sec of SECTIONS) {
    const s = document.createElement('section');
    s.className = 'toggles';
    const h = document.createElement('h2'); h.textContent = sec.title; s.appendChild(h);
    for (const item of sec.items) {
      if (item.type === 'select') {
        const lab = document.createElement('label'); lab.className = 'sel';
        const span = document.createElement('span'); span.textContent = item.label; lab.appendChild(span);
        const sel = document.createElement('select');
        for (const o of item.opts) { const opt = document.createElement('option'); opt.value = o; opt.textContent = prettySel(item.key, o); sel.appendChild(opt); }
        sel.value = settings[item.key] ?? item.opts[0];
        sel.addEventListener('change', () => { settings[item.key] = sel.value; saveSettings(); });
        lab.appendChild(sel); s.appendChild(lab);
      } else {
        const lab = document.createElement('label');
        const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = !!settings[item.key];
        cb.addEventListener('change', () => { settings[item.key] = cb.checked; saveSettings(); });
        lab.appendChild(cb); lab.appendChild(document.createTextNode(' ' + item.label));
        s.appendChild(lab);
      }
    }
    host.appendChild(s);
  }
}

async function refreshStats() {
  const { stats = {}, marks = {}, seen = {}, notes = {} } =
    await chrome.storage.local.get(['stats', 'marks', 'seen', 'notes']);
  let applied = 0;
  for (const m of Object.values(marks)) if (m.s === 'a') applied++;
  const ratings = ['rating:indeed', 'rating:glassdoor', 'rating:levels']
    .map(k => stats[k]).filter(Boolean)
    .reduce((t, s) => ({ checks: t.checks + (s.checks || 0), found: t.found + (s.found || 0) }), { checks: 0, found: 0 });
  const pct = s => s && s.checks ? Math.round((s.found / s.checks) * 100) + '%' : '–';
  const row = (k, s) => `<tr><td>${k}</td><td>${(s?.checks) || 0} (${pct(s)})</td></tr>`;
  document.getElementById('stats-body').innerHTML = `<table>
    ${row('LinkedIn checks', stats.linkedin)}${row('Indeed checks', stats.indeed)}${row('Company ratings', ratings)}
    <tr><td>Jobs seen</td><td>${Object.keys(seen).length}</td></tr>
    <tr><td>✓ Applied</td><td>${applied}</td></tr>
    <tr><td>Notes</td><td>${Object.keys(notes).length}</td></tr></table>`;
}

function csvEscape(v) { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

document.getElementById('btn-export-csv').addEventListener('click', async () => {
  const { marks = {} } = await chrome.storage.local.get('marks');
  const name = { i: 'interested', a: 'applied', x: 'hidden' };
  const rows = [['status', 'title', 'company', 'location', 'url', 'marked_at']];
  for (const [slug, m] of Object.entries(marks)) rows.push([
    name[m.s] || m.s, m.title || '', m.company || '', m.location || '',
    m.url || 'https://hiringcafe.com' + slug, new Date(m.t).toISOString()
  ]);
  download('hiringcafe-saved-jobs.csv', rows.map(r => r.map(csvEscape).join(',')).join('\r\n'), 'text/csv');
});

document.getElementById('btn-export-json').addEventListener('click', async () => {
  const data = await chrome.storage.local.get(['marks', 'notes', 'seen', 'blocklists', 'settings', 'filters', 'autoHide']);
  download('hiringcafe-plus-backup.json', JSON.stringify(data, null, 2), 'application/json');
});

document.getElementById('btn-clear-cache').addEventListener('click', async () => {
  const res = await chrome.runtime.sendMessage({ type: 'HCX_CLEAR_CACHE' });
  const btn = document.getElementById('btn-clear-cache');
  btn.textContent = `Cleared ${res?.cleared ?? 0}`;
  setTimeout(() => { btn.textContent = 'Clear check cache'; }, 1800);
  refreshStats();
});

document.getElementById('btn-reset-seen').addEventListener('click', async () => {
  await chrome.storage.local.remove('seen'); refreshStats();
});

async function load() {
  try {
    const mf = chrome.runtime.getManifest();
    document.getElementById('ver').textContent = 'v' + mf.version;
  } catch {}
  const data = await chrome.storage.local.get(['settings']);
  settings = { ...DEFAULTS, ...(data.settings || {}) };
  renderSections();
  refreshStats();
}
load();
