const MODEL = "gemini-3.1-flash-lite";

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Configurazione mancante: GOOGLE_API_KEY non impostata.' });
  }

  try {
    const requestBody = req.body;

    // Aggiunge configurazione per output JSON strutturato (supportato da questo modello)
    const geminiPayload = {
      ...requestBody,
      generationConfig: {
        temperature: 0.2,          // Bassa variabilità per risultati consistenti
        maxOutputTokens: 2048,     // Più che sufficiente per il JSON desiderato
        responseMimeType: "application/json"  // FORZA risposta JSON valido
      }
    };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(geminiPayload),
        signal: AbortSignal.timeout(35000) // 35 secondi max
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('Gemini API error:', response.status, data);
      return res.status(response.status).json({
        error: 'Errore API Gemini',
        detail: data.error?.message || 'Risposta non valida'
      });
    }

    // Verifica minima della struttura
    if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
      return res.status(500).json({ error: 'Risposta Gemini malformata: nessun contenuto valido' });
    }

    // La risposta è già in JSON (responseMimeType lo garantisce)
    // Restituiamo l'intero oggetto così com'è (il frontend lo parserà)
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json(data);

  } catch (err) {
    console.error('Backend Error:', err.message);
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'Timeout: Gemini non ha risposto in tempo' });
    }
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};
