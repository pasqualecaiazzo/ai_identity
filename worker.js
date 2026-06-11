import { onRequestGet as fetchPage, onRequestOptions as fetchOptions } from './functions/api/fetch-page.js';
import { onRequestPost as geminiAnalyze, onRequestOptions as geminiOptions } from './functions/api/gemini-analyze.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Crea un oggetto context compatibile con le Pages Functions
    const context = {
      request,
      env,
      ctx
    };

    // Routing delle API
    if (url.pathname === '/api/fetch-page') {
      if (request.method === 'OPTIONS') {
        return fetchOptions(context);
      }
      return fetchPage(context);
    }

    if (url.pathname === '/api/gemini-analyze') {
      if (request.method === 'OPTIONS') {
        return geminiOptions(context);
      }
      return geminiAnalyze(context);
    }

    // Se non è una rotta API, serve i file statici (index.html, assets, ecc.)
    return env.ASSETS.fetch(request);
  }
};
