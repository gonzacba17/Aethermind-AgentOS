'use strict';

const https = require('https');
const http = require('http');
const { ok, fail } = require('./ui.js');

const API_BASE = 'https://aethermind-agentos-production.up.railway.app';

function validateApiKey(apiKey) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${API_BASE}/v1/validate`);
    const client = url.protocol === 'https:' ? https : http;

    const req = client.get(
      url.href,
      {
        headers: {
          'X-API-Key': apiKey,
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const data = JSON.parse(body);
              if (data.valid) {
                ok(`API key valida — organizacion: ${data.organization}`);
                resolve(data);
              } else {
                fail('API key invalida');
                reject(new Error('API key invalida. Verifica tu AETHERMIND_API_KEY.'));
              }
            } catch (_) {
              ok('API key valida');
              resolve({});
            }
          } else if (res.statusCode === 401 || res.statusCode === 403) {
            fail('API key invalida o inactiva');
            reject(new Error('API key invalida. Verifica tu AETHERMIND_API_KEY.'));
          } else {
            fail(`Error validando API key (HTTP ${res.statusCode})`);
            reject(new Error(`Error del servidor (HTTP ${res.statusCode}). Intenta de nuevo.`));
          }
        });
      }
    );

    req.on('error', (err) => {
      fail(`No se pudo conectar al servidor: ${err.message}`);
      reject(new Error('No se pudo validar la API key. Verifica tu conexion a internet.'));
    });

    req.end();
  });
}

module.exports = { validateApiKey };
