(() => {
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === 'HCX_PING') { sendResponse({ pong: true }); return; }
    if (msg?.type !== 'HCX_GLASSDOOR_FETCH') return;
    (async () => {
      try {
        const res = await fetch(msg.url, { credentials: 'include', headers: { Accept: 'text/html,application/json' } });
        const text = await res.text();
        const challenge = res.status === 403 ||
          /just a moment|cf-challenge|cf-browser-verification|captcha|verify you are a human/i.test(text.slice(0, 4000));
        sendResponse({ ok: res.ok, status: res.status, challenge, text });
      } catch (e) {
        sendResponse({ ok: false, error: String(e && e.message || e) });
      }
    })();
    return true;
  });
})();
