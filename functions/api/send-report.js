export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  const apiKey = env.RESEND_API_KEY;
  const destinationEmail = env.DESTINATION_EMAIL;

  if (!apiKey || !destinationEmail) {
    return new Response(
      JSON.stringify({
        error: 'Configurazione mancante: verificare che RESEND_API_KEY e DESTINATION_EMAIL siano impostate.'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }

  try {
    const formData = await request.formData();
    const url = formData.get('url');
    const reportStr = formData.get('report');
    const file = formData.get('file');

    if (!url || !reportStr || !file) {
      return new Response(
        JSON.stringify({ error: 'Parametri URL, Report o File PDF mancanti.' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const report = JSON.parse(reportStr);
    const fileBuffer = await file.arrayBuffer();

    // Funzione helper per convertire ArrayBuffer in Base64 in modo sicuro (senza limiti di argomenti)
    const arrayBufferToBase64 = (buffer) => {
      let binary = '';
      const bytes = new Uint8Array(buffer);
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return btoa(binary);
    };

    const fileBase64 = arrayBufferToBase64(fileBuffer);

    const domain = url.replace(/https?:\/\//, '').replace(/\/.*/, '');

    // Funzione helper per ottenere il colore associato al punteggio
    const getScoreColor = (score) => {
      if (score >= 85) return '#2DB885'; // Eccellente (Verde)
      if (score >= 70) return '#A9C94C'; // Buono (Verde chiaro)
      if (score >= 50) return '#D4870E'; // Parziale (Arancio)
      return '#D84F35'; // Critico (Rosso)
    };

    const overallColor = getScoreColor(report.score);

    // Costruzione dell'email HTML con tabelle compatibili per i client di posta
    let htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Report AI Readiness per ${domain}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f4f4f7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f4f7; padding: 20px 0;">
        <tr>
          <td align="center">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
              
              <!-- HEADER -->
              <tr>
                <td style="background-color: #07070F; padding: 30px; text-align: center;">
                  <span style="font-size: 10px; letter-spacing: 0.35em; color: #C9A84C; text-transform: uppercase; font-weight: bold; display: block; margin-bottom: 5px;">AI Readiness Scanner</span>
                  <h1 style="color: #EDE8DF; font-family: Georgia, serif; font-size: 22px; margin: 0; font-weight: normal;">Report per <span style="color: #C9A84C;">${domain}</span></h1>
                </td>
              </tr>

              <!-- HERO SCORE -->
              <tr>
                <td style="padding: 30px 20px; text-align: center; border-bottom: 1px solid #e2e8f0;">
                  <table align="center" cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto 15px auto;">
                    <tr>
                      <td align="center" style="width: 100px; height: 100px; border-radius: 50%; border: 6px solid ${overallColor}; text-align: center; font-family: monospace; font-size: 32px; font-weight: bold; color: ${overallColor}; line-height: 100px;">
                        ${report.score}
                      </td>
                    </tr>
                  </table>
                  <h2 style="font-size: 18px; margin: 10px 0 5px 0; color: #0d0d1c; font-weight: bold;">${report.nome}</h2>
                  <p style="font-size: 13px; color: #8080a0; margin: 0; text-transform: uppercase; letter-spacing: 0.1em;">${report.tipo}</p>
                  ${report.percezione_ai ? `
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 20px;">
                      <tr>
                        <td style="background-color: #f7f7f9; border-left: 4px solid #C9A84C; padding: 15px; text-align: left; font-style: italic; color: #4a5568; font-size: 13px; line-height: 1.6;">
                          "${report.percezione_ai}"
                        </td>
                      </tr>
                    </table>
                  ` : ''}
                </td>
              </tr>

              <!-- GENERAL SYNTHESIS -->
              <tr>
                <td style="padding: 25px 20px; border-bottom: 1px solid #e2e8f0;">
                  <h3 style="font-size: 13px; letter-spacing: 0.1em; text-transform: uppercase; color: #C9A84C; margin: 0 0 10px 0; font-weight: bold;">Sintesi Generale</h3>
                  <p style="font-size: 13px; line-height: 1.6; color: #2d3748; margin: 0;">${report.sintesi || ''}</p>
                </td>
              </tr>

              <!-- DIMENSIONS -->
              <tr>
                <td style="padding: 25px 20px; border-bottom: 1px solid #e2e8f0;">
                  <h3 style="font-size: 13px; letter-spacing: 0.1em; text-transform: uppercase; color: #C9A84C; margin: 0 0 20px 0; font-weight: bold;">Analisi delle Dimensioni</h3>
                  
                  ${(report.dimensioni || []).map(dim => {
                    const dimColor = getScoreColor(dim.score);
                    return `
                      <div style="margin-bottom: 25px;">
                        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 8px;">
                          <tr>
                            <td style="font-size: 14px; font-weight: bold; color: #0d0d1c;">${dim.nome}</td>
                            <td align="right" style="font-size: 14px; font-weight: bold; color: ${dimColor}; font-family: monospace;">${dim.score}/100</td>
                          </tr>
                        </table>
                        
                        <!-- Barra di progresso tabellare compatibile -->
                        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 8px;">
                          <tr>
                            <td style="background-color: #e2e8f0; height: 8px; border-radius: 4px; width: 100%;">
                              <table width="${dim.score}%" cellpadding="0" cellspacing="0" border="0" height="8">
                                <tr>
                                  <td style="background-color: ${dimColor}; height: 8px; border-radius: 4px;"></td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                        </table>
                        
                        <p style="font-size: 13px; line-height: 1.6; color: #4a5568; margin: 0 0 5px 0;">${dim.sintesi}</p>
                        ${dim.gap && dim.gap !== 'undefined' ? `
                          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 8px;">
                            <tr>
                              <td style="background-color: #fff5f5; border-left: 3px solid #D84F35; padding: 8px 12px; font-size: 12px; color: #D84F35; line-height: 1.5;">
                                <strong>Criticità:</strong> ${dim.gap}
                              </td>
                            </tr>
                          </table>
                        ` : ''}
                      </div>
                    `;
                  }).join('')}
                </td>
              </tr>

              <!-- STRENGTHS -->
              ${report.forze && report.forze.length > 0 ? `
                <tr>
                  <td style="padding: 25px 20px; border-bottom: 1px solid #e2e8f0; background-color: #fafcfb;">
                    <h3 style="font-size: 13px; letter-spacing: 0.1em; text-transform: uppercase; color: #2DB885; margin: 0 0 15px 0; font-weight: bold;">Punti di Forza</h3>
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      ${report.forze.map(f => `
                        <tr>
                          <td valign="top" style="font-size: 13px; color: #2DB885; padding-right: 10px; line-height: 1.6;">◆</td>
                          <td style="font-size: 13px; line-height: 1.6; color: #2d3748; padding-bottom: 8px;">${f}</td>
                        </tr>
                      `).join('')}
                    </table>
                  </td>
                </tr>
              ` : ''}

              <!-- GAPS -->
              ${report.lacune && report.lacune.length > 0 ? `
                <tr>
                  <td style="padding: 25px 20px; border-bottom: 1px solid #e2e8f0; background-color: #fcfafa;">
                    <h3 style="font-size: 13px; letter-spacing: 0.1em; text-transform: uppercase; color: #D84F35; margin: 0 0 15px 0; font-weight: bold;">Lacune Critiche</h3>
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      ${report.lacune.map(l => `
                        <tr>
                          <td valign="top" style="font-size: 13px; color: #D84F35; padding-right: 10px; line-height: 1.6;">◆</td>
                          <td style="font-size: 13px; line-height: 1.6; color: #2d3748; padding-bottom: 8px;">${l}</td>
                        </tr>
                      `).join('')}
                    </table>
                  </td>
                </tr>
              ` : ''}

              <!-- NEXT STEPS -->
              ${report.passi && report.passi.length > 0 ? `
                <tr>
                  <td style="padding: 25px 20px; background-color: #fdfcfa;">
                    <h3 style="font-size: 13px; letter-spacing: 0.1em; text-transform: uppercase; color: #D4870E; margin: 0 0 15px 0; font-weight: bold;">Prossimi Passi Consigliati</h3>
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      ${report.passi.map(p => {
                        const priorityColor = p.p === 'alta' || p.p === 'high' ? '#D84F35' : p.p === 'media' || p.p === 'medium' ? '#D4870E' : '#8080A0';
                        return `
                          <tr>
                            <td valign="top" style="font-size: 11px; font-family: monospace; font-weight: bold; color: ${priorityColor}; padding-right: 10px; line-height: 1.6; white-space: nowrap; text-transform: uppercase;">
                              [${p.p}]
                            </td>
                            <td style="font-size: 13px; line-height: 1.6; color: #2d3748; padding-bottom: 12px;">
                              ${p.a}
                            </td>
                          </tr>
                        `;
                      }).join('')}
                    </table>
                  </td>
                </tr>
              ` : ''}

              <!-- FOOTER -->
              <tr>
                <td style="background-color: #07070F; padding: 20px; text-align: center; font-size: 11px; color: #8080a0;">
                  Digital Identity Scanner<br>
                  <a href="${url}" target="_blank" style="color: #C9A84C; text-decoration: none; margin-top: 5px; display: inline-block;">Visualizza il sito analizzato</a>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
    `;

    // Se l'utente ha configurato una SENDER_EMAIL personalizzata usa quella, altrimenti usa l'email di default per gli account non verificati.
    const senderEmail = env.SENDER_EMAIL || 'onboarding@resend.dev';

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: `AI Scan <${senderEmail}>`,
        to: destinationEmail,
        subject: `Report AI Readiness: ${domain} (Score: ${report.score}/100)`,
        html: htmlContent,
        attachments: [
          {
            filename: file.name,
            content: fileBase64
          }
        ]
      })
    });

    const resData = await response.json();

    if (!response.ok) {
      console.error('Error from Resend API:', response.status, resData);
      return new Response(
        JSON.stringify({ error: 'Errore durante l\'invio dell\'email.', details: resData }),
        {
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    return new Response(
      JSON.stringify({ success: true, messageId: resData.id }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (err) {
    console.error('Email API route error:', err.message);
    return new Response(
      JSON.stringify({ error: 'Errore interno del server.', details: err.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
}

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
