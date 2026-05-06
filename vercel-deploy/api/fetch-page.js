module.exports = async (req, res) => {
  const url = req.query?.url;
  const raw = req.query?.raw === '1';

  res.setHeader('Access-Control-Allow-Origin', '*');

  if (!url) {
    return res.status(400).send('Missing url parameter');
  }

  const REDIRECT_PATTERNS = [
    /hang\s*tight/i, /routing\s*to/i, /redirecting/i,
    /please\s*wait/i, /just\s*a\s*moment/i,
    /checking\s*your\s*browser/i, /enable\s*javascript/i,
    /location\.replace|location\.href\s*=/i,
    /<meta[^>]+http-equiv=["']?refresh["']?/i,
  ];

  async function tryFetch(headers, timeoutMs) {
    const response = await fetch(url, {
      headers, redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
    });
    const html = await response.text();
    return { html, finalUrl: response.url };
  }

  // Modalità raw: un solo tentativo, nessun controllo redirect
  if (raw) {
    try {
      const { html, finalUrl } = await tryFetch({
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
      }, 7000);
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('X-Final-Url', finalUrl);
      return res.status(200).send(html);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // Modalità normale: 3 tentativi con User-Agent diversi
  const attempts = [
    { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', 'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8', 'Accept-Language': 'en-US,en;q=0.9' },
    { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36', 'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8', 'Accept-Language': 'en-US,en;q=0.9' },
    { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36', 'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8', 'Accept-Language': 'it-IT,it;q=0.9,en;q=0.8' },
  ];

  let lastError = null;
  for (const headers of attempts) {
    try {
      const { html, finalUrl } = await tryFetch(headers, 8000);
      const isTrapped = REDIRECT_PATTERNS.some(p => p.test(html.substring(0, 3000)));
      if (isTrapped) { console.warn('Trap detected, next attempt. finalUrl:', finalUrl); continue; }
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('X-Final-Url', finalUrl);
      return res.status(200).send(html);
    } catch (err) { lastError = err; }
  }

  return res.status(422).json({
    error: lastError?.message || 'Solo redirect o pagine di transizione trovate',
    trapped: true,
  });
};
