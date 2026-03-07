'use strict';

const https = require('https');
const http = require('http');
const { ok, fail } = require('./ui.js');

function validateApiKey(apiKey) {
  return new Promise((resolve, reject) => {
    const url = new URL('https://aethermind-agent-os.vercel.app/api/client/me');
    const client = url.protocol === 'https:' ? https : http;

    const req = client.get(
      url.href,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const data = JSON.parse(body);
              const email = data.email || data.user?.email || 'usuario verificado';
              ok(`API key valida — conectado como ${email}`);
              resolve(data);
            } catch (_) {
              ok('API key valida');
              resolve({});
            }
          } else {
            fail(`API key invalida (HTTP ${res.statusCode})`);
            reject(new Error(`API key invalida. Verifica tu AETHERMIND_API_KEY.`));
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
