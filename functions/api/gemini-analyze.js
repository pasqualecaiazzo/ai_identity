const MODEL = "gemini-3.1-flash-lite";

export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  const apiKey = env.GOOGLE_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'Configurazione mancante: GOOGLE_API_KEY non impostata.' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }

  try {
    const requestBody = await request.json();

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
      return new Response(
        JSON.stringify({
          error: 'Errore API Gemini',
          detail: data.error?.message || 'Risposta non valida'
        }),
        {
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Verifica minima della struttura
    if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
      return new Response(
        JSON.stringify({ error: 'Risposta Gemini malformata: nessun contenuto valido' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Restituiamo l'intero oggetto così com'è (il frontend lo parserà)
    return new Response(
      JSON.stringify(data),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (err) {
    console.error('Backend Error:', err.message);
    if (err.name === 'AbortError') {
      return new Response(
        JSON.stringify({ error: 'Timeout: Gemini non ha risposto in tempo' }),
        {
          status: 504,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
    return new Response(
      JSON.stringify({ error: 'Internal Server Error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
}

// Gestione delle richieste OPTIONS preflight
export async function onRequestOptions(context) {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  });
}
