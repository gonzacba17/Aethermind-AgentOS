# 🧪 Manual Testing Checklist - Aethermind SaaS Hybrid

## Pre-requisitos

- [ ] API deployada en Railway
- [ ] Dashboard deployado en Vercel
- [ ] Database con migraciones aplicadas
- [ ] SDK construido (`pnpm build --filter=@aethermind/agent`)

---

## TEST 1: Signup & Onboarding (5 min)

### 1.1. Crear cuenta nueva

```
✅ Ir a: https://dashboard.aethermind.io
✅ Click "Sign Up"
✅ Autenticar con Google
✅ Verificar redirección a /onboarding
```

### 1.2. Verificar API Key generado

```
✅ Ver API key en pantalla (formato: aether_xxxxxxxxxx)
✅ Click "Copy to Clipboard" funciona
✅ Click "Show/Hide" funciona
✅ Quick start code visible
```

### 1.3. Verificar en Database

```bash
# Conectar a Railway DB
railway run npx prisma studio

# O usar psql:
psql $DATABASE_URL

SELECT id, name, plan FROM organizations ORDER BY created_at DESC LIMIT 1;
# Debería mostrar tu org recién creada

SELECT api_key_hash FROM organizations WHERE id = '<tu-org-id>';
# Debería tener hash bcrypt (empieza con $2a$)
```

**✅ TEST 1 PASS** si:

- Org creada en DB
- API key generado y hasheado
- UI funciona correctamente

---

## TEST 2: SDK Installation (10 min)

### 2.1. Crear proyecto de prueba

```bash
mkdir test-aethermind
cd test-aethermind
npm init -y
npm install openai @aethermind/agent
```

### 2.2. Crear archivo de test

```typescript
// index.ts
import OpenAI from "openai";
import { initAethermind } from "@aethermind/agent";

// Initialize Aethermind
initAethermind({
  apiKey: "aether_your_key_from_onboarding",
  endpoint: "https://your-api.railway.app",
});

// Make OpenAI call
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function test() {
  console.log("🚀 Making OpenAI call...");

  const completion = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [{ role: "user", content: "Say hello!" }],
  });

  console.log("✅ Response:", completion.choices[0].message.content);
  console.log("📊 Waiting for telemetry flush (30s)...");

  // Wait for batch to flush
  await new Promise((resolve) => setTimeout(resolve, 35000));

  console.log("✅ Test complete! Check dashboard.");
  process.exit(0);
}

test();
```

### 2.3. Ejecutar test

```bash
export OPENAI_API_KEY=sk-your-key
npx ts-node index.ts
```

### 2.4. Verificar logs esperados

```
Esperado en consola:
✅ SDK inicializa correctamente
✅ OpenAI call se ejecuta
✅ Response recibida
✅ Waiting for flush...
```

**✅ TEST 2 PASS** si:

- SDK inicializa sin errores
- OpenAI call se ejecuta normal
- App no crashea
- Evento se envía en background

---

## TEST 3: API Ingestion (5 min)

### 3.1. Verificar endpoint responde

```bash
curl -X POST https://your-api.railway.app/v1/ingest \
  -H "Content-Type: application/json" \
  -H "X-API-Key: aether_your_key" \
  -d '{
    "events": [
      {
        "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'",
        "provider": "openai",
        "model": "gpt-3.5-turbo",
        "tokens": {
          "promptTokens": 10,
          "completionTokens": 20,
          "totalTokens": 30
        },
        "cost": 0.00015,
        "latency": 1200,
        "status": "success"
      }
    ]
  }'

# Esperado: HTTP 202
# Response: {"accepted":1,"message":"Events queued for processing"}
```

### 3.2. Verificar evento en DB

```sql
-- Esperar 10 segundos para el flush del buffer

SELECT * FROM telemetry_events
WHERE organization_id = '<tu-org-id>'
ORDER BY timestamp DESC
LIMIT 1;

-- Debería mostrar el evento que enviaste
```

### 3.3. Test de autenticación

```bash
# Invalid API key
curl -X POST https://your-api.railway.app/v1/ingest \
  -H "X-API-Key: invalid" \
  -d '{"events":[]}'

# Esperado: HTTP 401
# Response: {"error":"Unauthorized","message":"Invalid API key"}
```

### 3.4. Test de rate limiting

```bash
# Enviar 150 requests rápido (si FREE plan = 100/min)
for i in {1..150}; do
  curl -X POST https://your-api.railway.app/v1/ingest \
    -H "X-API-Key: aether_your_key" \
    -H "Content-Type: application/json" \
    -d '{"events":[]}' &
done
wait

# Algunas deberían devolver HTTP 429
```

**✅ TEST 3 PASS** si:

- Endpoint acepta eventos válidos (202)
- Rechaza API keys inválidos (401)
- Rate limiting funciona (429 después de X requests)
- Eventos aparecen en DB

---

## TEST 4: Dashboard Display (10 min)

### 4.1. Verificar página de Telemetry

```
✅ Ir a: https://dashboard.aethermind.io/telemetry?orgId=<your-org-id>
✅ Ver 4 metric cards:
   - Total Cost (debería mostrar $0.00015 del test)
   - Total Requests (debería mostrar 2: test SDK + curl)
   - Average Latency (debería mostrar ~1200ms)
   - Error Rate (0%)

✅ Ver gráfico de Cost Trend
   - Debería tener 1 punto en el día de hoy

✅ Ver tabla de Recent Events
   - Debería mostrar los 2 eventos
   - Columns: timestamp, provider, model, cost, status
```

### 4.2. Verificar auto-refresh

```
1. Hacer otra llamada con el SDK de TEST 2
2. Esperar 30 segundos
3. Dashboard debería actualizarse automáticamente
4. Nuevo evento debería aparecer sin refresh manual
```

### 4.3. Verificar Settings page

```
✅ Ir a: https://dashboard.aethermind.io/settings
✅ Ver información de organización:
   - Organization Name
   - Plan (FREE)
   - API Key (hidden por defecto)

✅ Test API key rotation:
   - Click "Rotate API Key"
   - Confirmar
   - Nuevo key generado
   - Verificar en DB que cambió el hash
```

**✅ TEST 4 PASS** si:

- Métricas se calculan correctamente
- Eventos se muestran en tabla
- Auto-refresh funciona
- API key rotation funciona

---

## TEST 5: Multi-tenant Isolation (5 min)

### 5.1. Crear segunda organización

```
1. Abrir navegador en modo incógnito
2. Sign up con otra cuenta Google
3. Copiar nuevo API key (llamémoslo aether_org2_xxx)
```

### 5.2. Enviar eventos de org2

```bash
curl -X POST https://your-api.railway.app/v1/ingest \
  -H "X-API-Key: aether_org2_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "events": [{
      "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'",
      "provider": "anthropic",
      "model": "claude-3-sonnet",
      "tokens": {
        "promptTokens": 100,
        "completionTokens": 200,
        "totalTokens": 300
      },
      "cost": 0.005,
      "latency": 800,
      "status": "success"
    }]
  }'
```

### 5.3. Verificar aislamiento

```
✅ Dashboard de org1:
   - NO debería ver el evento de org2
   - Solo sus propios 2-3 eventos

✅ Dashboard de org2:
   - Solo debería ver su 1 evento (Anthropic)
   - NO ver eventos de org1

✅ En DB:
SELECT organization_id, COUNT(*)
FROM telemetry_events
GROUP BY organization_id;

-- Debería mostrar:
-- <org1-id> | 3
-- <org2-id> | 1
```

**✅ TEST 5 PASS** si:

- Eventos correctamente asociados a su org
- Dashboards muestran solo datos de su org
- No hay data leakage entre orgs

---

## TEST 6: Error Handling (5 min)

### 6.1. SDK con API down

```typescript
// Cambiar endpoint a URL inválida
initAethermind({
  apiKey: 'aether_xxx',
  endpoint: 'https://fake-url-that-doesnt-exist.com',
});

// Hacer llamada OpenAI
const completion = await openai.chat.completions.create({...});

// ✅ Debería:
// - OpenAI call funcionar normalmente
// - SDK NO crashear la app
// - Error logged pero silencioso
```

### 6.2. API con payload inválido

```bash
curl -X POST https://your-api.railway.app/v1/ingest \
  -H "X-API-Key: aether_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "events": [{
      "invalid": "schema"
    }]
  }'

# Esperado: HTTP 400
# Response: {"error": "Invalid request body", "message": "..."}
```

### 6.3. API key expirado/rotado

```bash
# Usar un API key viejo (después de rotation)
curl -X POST https://your-api.railway.app/v1/ingest \
  -H "X-API-Key: aether_old_key" \
  -d '{"events":[]}'

# Esperado: HTTP 401
```

**✅ TEST 6 PASS** si:

- SDK NO crashea la app del cliente
- API valida payloads correctamente
- Auth rechaza keys inválidos/expirados

---

## TEST 7: Performance (10 min)

### 7.1. Latency del SDK

```typescript
// Medir overhead del SDK
const start = Date.now();

await openai.chat.completions.create({...});

const duration = Date.now() - start;
console.log('Total time:', duration, 'ms');

// ✅ Overhead del SDK debería ser < 5ms
// (la mayoría del tiempo es la llamada a OpenAI)
```

### 7.2. Throughput de API

```bash
# Enviar 100 eventos en batch
curl -X POST https://your-api.railway.app/v1/ingest \
  -H "X-API-Key: aether_xxx" \
  -H "Content-Type: application/json" \
  -d @batch-100.json

# Medir tiempo de respuesta
# ✅ Debería responder en < 100ms (202 Accepted)
```

### 7.3. Dashboard load time

```
1. Abrir DevTools → Network
2. Ir a /telemetry
3. Medir tiempo hasta "DOMContentLoaded"

✅ Target: < 2 segundos
```

**✅ TEST 7 PASS** si:

- SDK overhead < 5ms
- API responde en < 100ms para batch de 100
- Dashboard carga en < 2s

---

## RESUMEN DE TESTS

| Test              | Objetivo                | Time   | Status |
| ----------------- | ----------------------- | ------ | ------ |
| 1. Signup         | ✅ Crear org + API key  | 5 min  | ⬜     |
| 2. SDK            | ✅ Interceptar OpenAI   | 10 min | ⬜     |
| 3. API            | ✅ Ingerir eventos      | 5 min  | ⬜     |
| 4. Dashboard      | ✅ Visualizar métricas  | 10 min | ⬜     |
| 5. Multi-tenant   | ✅ Aislamiento de datos | 5 min  | ⬜     |
| 6. Error Handling | ✅ Resiliencia          | 5 min  | ⬜     |
| 7. Performance    | ✅ Latencia/throughput  | 10 min | ⬜     |

**Total:** ~50 minutos

---

## SI TODO PASA ✅

**¡Felicidades!** Tu SaaS híbrido está 100% funcional.

### Siguiente paso: BETA LAUNCH

1. **Publicar SDK en NPM**:

   ```bash
   cd packages/agent
   npm version 0.1.0
   npm publish --access public
   ```

2. **Crear landing page** (o usar tu dashboard como landing)

3. **Reclutar 10 beta users**:

   - Post en r/MachineLearning
   - Tweet explicando el problema
   - Direct outreach a 20 empresas

4. **Configurar analytics**:

   ```bash
   npm install posthog-js
   # Track: signups, first_event, upgrades
   ```

5. **Setup Stripe** para payments:
   - Crear productos: Free, Startup ($49), Business ($199)
   - Implementar checkout flow

---

## SI ALGO FALLA ❌

### Debugging Checklist

**SDK no captura eventos**:

```typescript
// Añadir debug viendo el código
// Verificar que OpenAI/Anthropic estén importados
```

**API devuelve 500**:

```bash
# Ver logs en Railway
railway logs --tail 100

# Buscar stacktrace
```

**Dashboard no muestra datos**:

```sql
-- Verificar datos en DB
SELECT COUNT(*) FROM telemetry_events;

-- Si hay datos pero no aparecen:
-- Revisar /api/metrics route
-- Verificar filters de organizationId
```

**Rate limiting muy agresivo**:

```typescript
// Ajustar en apps/api/src/middleware/rateLimiter.ts
// Increase limits temporalmente para testing
```

---

**Happy Testing! 🧪🚀**
