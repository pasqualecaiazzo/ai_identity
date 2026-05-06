module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  // Protezione origine — usa la variabile ALLOWED_ORIGIN su Vercel
  // oppure controlla il suffisso del dominio Vercel
  const origin  = req.headers.origin  || '';
  const referer = req.headers.referer || '';
  const allowedSuffixes = (process.env.ALLOWED_ORIGIN || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  if (allowedSuffixes.length > 0) {
    const isSameOrigin     = !origin;
    const isAllowedOrigin  = allowedSuffixes.some(s => origin.endsWith(s));
    const isAllowedReferer = allowedSuffixes.some(s => referer.includes(s));
    if (!isSameOrigin && !isAllowedOrigin && !isAllowedReferer) {
      return res.status(403).send('Forbidden');
    }
  }
  // Se ALLOWED_ORIGIN non è configurata, non blocca nulla (utile in fase di setup)

  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY non configurata.' });
  }

  try {
    const body = req.body; // Vercel auto-parsa il JSON
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(55000), // sotto i 60s di Vercel
      }
    );
    const data = await response.text();
    res.setHeader('Content-Type', 'application/json');
    return res.status(response.status).send(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
