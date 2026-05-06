exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // Usa endsWith per coprire sia il dominio principale che i deploy preview
  // (es. https://abc123--regal-snickerdoodle-04535b.netlify.app)
  const origin  = event.headers.origin  || '';
  const referer = event.headers.referer || '';
  const allowedSuffixes = [
    'regal-snickerdoodle-04535b.netlify.app',
    // aggiungi domini custom qui, es: 'pasqualecaiazzo.com'
  ];
  const isSameOrigin     = !origin;
  const isAllowedOrigin  = allowedSuffixes.some(s => origin.endsWith(s));
  const isAllowedReferer = allowedSuffixes.some(s => referer.includes(s));

  if (!isSameOrigin && !isAllowedOrigin && !isAllowedReferer) {
    return { statusCode: 403, body: 'Forbidden' };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'GEMINI_API_KEY non configurata.' }),
    };
  }

  try {
    const body = JSON.parse(event.body);
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(25000),
      }
    );
    const data = await response.text();
    return {
      statusCode: response.status,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: data,
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
