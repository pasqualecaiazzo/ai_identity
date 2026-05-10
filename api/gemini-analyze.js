const MODEL = "gemini-3.1-flash";

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Configurazione mancante.' });

  try {
    const body = req.body;
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...body,
          generationConfig: {
            temperature: 0.1, // Riduce la variazione dei testi
            maxOutputTokens: 1500,
            responseMimeType: "application/json" // Forza l'AI a rispondere solo con JSON
          }
        }),
        signal: AbortSignal.timeout(30000)
      }
    );

    const data = await response.json();
    
    if (response.status !== 200) {
      return res.status(response.status).json({ error: 'Errore API Gemini', detail: data });
    }

    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json(data);

  } catch (err) {
    console.error('Backend Error:', err.message);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};
