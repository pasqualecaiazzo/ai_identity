function isValidUrl(urlString) {
  try {
    const url = new URL(urlString);
    const allowedSchemes = ['http:', 'https:'];
    if (!allowedSchemes.includes(url.protocol)) return false;
    // Blocca IP privati e localhost
    const hostname = url.hostname;
    const privateIpRegex = /^(127\.0\.0\.1|localhost|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2[0-9]|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+|169\.254\.\d+\.\d+)$/;
    if (privateIpRegex.test(hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

export async function onRequestGet(context) {
  const { request } = context;
  const urlObj = new URL(request.url);
  const urlParam = urlObj.searchParams.get('url');
  const rawParam = urlObj.searchParams.get('raw') === '1';

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
  };

  if (!urlParam) {
    return new Response('Missing url parameter', { status: 400, headers: corsHeaders });
  }
  if (!isValidUrl(urlParam)) {
    return new Response('URL non valido o non consentito', { status: 400, headers: corsHeaders });
  }

  const REDIRECT_PATTERNS = [
    /hang\s*tight/i, /routing\s*to/i, /redirecting/i,
    /please\s*wait/i, /just\s*a\s*moment/i,
    /checking\s*your\s*browser/i, /enable\s*javascript/i,
    /location\.replace|location\.href\s*=/i,
    /<meta[^>]+http-equiv=["']?refresh["']?/i,
  ];

  async function tryFetch(headers, timeoutMs) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(urlParam, {
        headers,
        redirect: 'follow',
        signal: controller.signal,
      });
      const html = await response.text();
      return { html, finalUrl: response.url };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // Modalità raw: un solo tentativo, nessun controllo redirect
  if (rawParam) {
    try {
      const { html, finalUrl } = await tryFetch({
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
      }, 10000);

      return new Response(html, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/plain; charset=utf-8',
          'X-Final-Url': finalUrl
        }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
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
      const { html, finalUrl } = await tryFetch(headers, 12000);
      const isTrapped = REDIRECT_PATTERNS.some(p => p.test(html.substring(0, 3000)));
      if (isTrapped) {
        console.warn('Trap detected, next attempt. finalUrl:', finalUrl);
        continue;
      }
      return new Response(html, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/html; charset=utf-8',
          'X-Final-Url': finalUrl
        }
      });
    } catch (err) {
      lastError = err;
    }
  }

  return new Response(
    JSON.stringify({
      error: lastError?.message || 'Solo redirect o pagine di transizione trovate',
      trapped: true,
    }),
    {
      status: 422,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  );
}

// Gestione delle richieste OPTIONS preflight
export async function onRequestOptions(context) {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  });
}
