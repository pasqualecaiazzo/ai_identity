// Catena di fallback ordinata per quota disponibile sul free tier
// Se un modello dà 429/503, passa automaticamente al successivo
const MODELS = [
  'gemini-2.5-flash-lite',         // primario — più economico, 20 RPD
  'gemini-3.1-flash-lite-preview', // fallback 1 — 50 RPD, più headroom
  'gemini-3-flash-preview',        // fallback 2 — 5 RPM, più capace
  'gemini-2.5-flash',              // fallback 3 — ultimo tentativo
];

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const origin  = req.headers.origin  || '';
  const referer = req.headers.referer || '';
  const allowedSuffixes = (process.env.ALLOWED_ORIGIN || '')
    .split(',').map(s => s.trim()).filter(Boolean);

  if (allowedSuffixes.length > 0) {
    const isSameOrigin     = !origin;
    const isAllowedOrigin  = allowedSuffixes.some(s => origin.endsWith(s));
    const isAllowedReferer = allowedSuffixes.some(s => referer.includes(s));
    if (!isSameOrigin && !isAllowedOrigin && !isAllowedReferer) {
      return res.status(403).send('Forbidden');
    }
  }

  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GOOGLE_API_KEY non configurata.' });
  }

  const body = req.body;
  let lastError = null;

  for (const model of MODELS) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(55000),
        }
      );

      const data = await response.text();

      if (response.status === 429 || response.status === 503) {
        console.warn(`Model ${model} rate limited (${response.status}), trying next...`);
        lastError = { status: response.status, data };
        continue;
      }

      console.log(`Model ${model} responded with ${response.status}`);
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('X-Model-Used', model);
      return res.status(response.status).send(data);

    } catch (err) {
      console.warn(`Model ${model} threw:`, err.message);
      lastError = { status: 500, data: JSON.stringify({ error: err.message }) };
    }
  }

  res.setHeader('Content-Type', 'application/json');
  return res.status(lastError?.status || 429).send(
    lastError?.data || JSON.stringify({ error: 'Tutti i modelli Gemini hanno raggiunto il rate limit.' })
  );
};
