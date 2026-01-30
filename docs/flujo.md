# 🎯 MODELO DE NEGOCIO - Aethermind como SaaS

## TU PRODUCTO (Lo que tú ofreces)

```
┌─────────────────────────────────────────────────────────────────┐
│                     AETHERMIND (Tu SaaS)                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. DASHBOARD (Web)           2. API (Backend)                 │
│  ┌─────────────────┐          ┌─────────────────┐               │
│  │ dashboard.      │          │ api.            │               │
│  │ aethermind.io   │          │ aethermind.io   │               │
│  └─────────────────┘          └─────────────────┘               │
│                                                                 │
│  3. SDK (Lo que descargan tus clientes)                        │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  npm install @aethermind/agent                              ││
│  │  (paquete publicado en NPM que cualquiera puede instalar)   ││fff
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## FLUJO PARA UNA EMPRESA CLIENTE

### Paso 1: Empresa se registra en tu Dashboard 👤

```
Empresa cliente va a → dashboard.aethermind.io
                      ↓
                   [Registrar cuenta]
                      ↓
               Obtienen su API Key: "aether_abc123xyz"
```

### Paso 2: Empresa instala el SDK en su proyecto 📦

En el código de la empresa (su proyecto con OpenAI):

```bash
# El desarrollador de la empresa ejecuta:
npm install @aethermind/agent
```

Esto descarga el paquete desde NPM (igual que instalar cualquier otra librería como `axios` o `react`).

### Paso 3: Empresa agrega UNA línea de código ✏️

```javascript
// archivo: app.js (código del cliente)

import { initAethermind } from "@aethermind/agent"; // ← AGREGAN ESTO

// Su API Key que obtuvieron del dashboard
initAethermind({
  apiKey: "aether_abc123xyz", // ← Su key única
});

// El resto de su código con OpenAI NO CAMBIA
import OpenAI from "openai";
const openai = new OpenAI({ apiKey: "sk-..." });

const response = await openai.chat.completions.create({
  model: "gpt-4",
  messages: [{ role: "user", content: "Hola" }],
});
```

### Paso 4: Empresa ve sus costos en TU Dashboard 📊

```
La empresa va a → dashboard.aethermind.io
                 ↓
              [Login con su cuenta]
                 ↓
              Ve SOLO SUS datos:
              - $150 gastados este mes
              - 500K tokens usados
              - GPT-4 es el 70% del gasto
              - etc.
```

---

## DIAGRAMA COMPLETO

```
┌──────────────────────────────────────────────────────────────────────┐
│                         EMPRESAS CLIENTES                            │
├────────────────┬─────────────────┬─────────────────┬─────────────────┤
│   Empresa A    │   Empresa B     │   Empresa C     │   Empresa D     │
│   (Fintech)    │   (Healthcare)  │   (E-commerce)  │   (Startup)     │
└───────┬────────┴────────┬────────┴────────┬────────┴────────┬────────┘
        │                 │                 │                 │
        │  SDK instalado  │   SDK instalado │   SDK instalado │
        │  + API Key A    │   + API Key B   │   + API Key C   │
        │                 │                 │                 │
        └────────┬────────┴────────┬────────┴────────┬────────┘
                 │                 │                 │
                 ▼                 ▼                 ▼
        ┌─────────────────────────────────────────────────────┐
        │                  TU API BACKEND                      │
        │              api.aethermind.io                       │
        │                                                      │
        │  Recibe telemetría de TODAS las empresas            │
        │  Cada request trae su API Key para identificar      │
        └──────────────────────┬──────────────────────────────┘
                               │
                               ▼
        ┌─────────────────────────────────────────────────────┐
        │                  TU DATABASE                         │
        │              (PostgreSQL)                            │
        │                                                      │
        │  Empresa A: $500 gastados, 1M tokens                │
        │  Empresa B: $2,000 gastados, 5M tokens              │
        │  Empresa C: $150 gastados, 300K tokens              │
        └──────────────────────┬──────────────────────────────┘
                               │
                               ▼
        ┌─────────────────────────────────────────────────────┐
        │                TU DASHBOARD                          │
        │            dashboard.aethermind.io                   │
        │                                                      │
        │  Cada empresa ve SOLO SUS datos cuando hace login   │
        └─────────────────────────────────────────────────────┘
```

---

## ¿QUÉ ES UN SDK? 📦

**SDK = Software Development Kit** (Kit de Desarrollo de Software)

Es simplemente una **librería de código** que tus clientes instalan en sus proyectos.

Ejemplos famosos de SDKs:

- `npm install stripe` → SDK de Stripe para procesar pagos
- `npm install @sentry/node` → SDK de Sentry para monitorear errores
- `npm install firebase` → SDK de Firebase
- `npm install @aethermind/agent` → **TU SDK** para monitorear costos de IA

---

## RESUMEN DEL MODELO

| Componente      | Dónde vive            | Quién lo usa                          |
| --------------- | --------------------- | ------------------------------------- |
| **Dashboard**   | Tu servidor (Vercel)  | Empresas ven sus datos                |
| **API Backend** | Tu servidor (Railway) | Recibe datos de los SDKs              |
| **SDK**         | NPM público           | Empresas lo instalan en sus proyectos |
| **Database**    | Tu servidor           | Almacena datos de todas las empresas  |

---

## TU MODELO DE INGRESOS 💰

```
┌─────────────────────────────────────────────────────────────┐
│                     PLANES DE PRICING                       │
├─────────────────┬─────────────────┬─────────────────────────┤
│    FREE         │     PRO         │     ENTERPRISE          │
│    $0/mes       │     $29/mes     │     $99+/mes            │
├─────────────────┼─────────────────┼─────────────────────────┤
│ 3 agentes       │ 50 agentes      │ Ilimitados              │
│ 30 días logs    │ 90 días logs    │ 1 año logs              │
│ 100K eventos    │ 1M eventos      │ Ilimitados              │
│ Email support   │ Priority support│ Dedicated support       │
└─────────────────┴─────────────────┴─────────────────────────┘
```

---

## FLUJO TÉCNICO DETALLADO

### Cómo el SDK captura los datos

```
1. Cliente llama a OpenAI
   openai.chat.completions.create(...)
           ↓
2. SDK intercepta la llamada (monkey patching)
   - Captura: modelo, tokens, timestamp
   - NO bloquea la llamada
           ↓
3. Llamada se ejecuta NORMAL a OpenAI
           ↓
4. OpenAI responde
           ↓
5. SDK calcula:
   - Costo basado en modelo y tokens
   - Latencia de la llamada
           ↓
6. SDK guarda en buffer local
   (no envía inmediatamente)
           ↓
7. Cada 30 segundos (configurable):
   - SDK envía batch de eventos
   - POST https://api.aethermind.io/telemetry
   - Headers: { Authorization: "Bearer aether_abc123xyz" }
           ↓
8. Tu API recibe y guarda en PostgreSQL
           ↓
9. Dashboard muestra datos en tiempo real
```

### Características del SDK

- **Zero overhead**: < 5ms de latencia adicional
- **Resiliente**: Si tu API está caída, el código del cliente sigue funcionando
- **Batching**: No envía cada request, agrupa en lotes
- **Async**: Todo en background, nunca bloquea

---

## EJEMPLO DE PRICING VS COMPETENCIA

| Feature             | Aethermind | LangSmith | Helicone |
| ------------------- | ---------- | --------- | -------- |
| Tracking automático | ✅         | ✅        | ✅       |
| Multi-provider      | ✅         | Parcial   | ✅       |
| Real-time dashboard | ✅         | ✅        | ✅       |
| Budget alerts       | ✅         | ❌        | ✅       |
| Self-hosted option  | ✅         | ❌        | ❌       |
| Precio inicio       | $0/mes     | $39/mes   | $0/mes   |

---

## PRÓXIMOS PASOS PARA MONETIZAR

1. **Publicar SDK en NPM**: `npm publish` del paquete `@aethermind/agent`
2. **Desplegar Dashboard**: Ya está en Vercel
3. **Desplegar API**: Ya está en Railway
4. **Agregar Stripe**: Ya integrado en el código
5. **Crear landing page**: Explicar el producto
6. **Buscar beta users**: Empresas que usen OpenAI/Anthropic

---

_Documento generado: 23-Enero-2026_
