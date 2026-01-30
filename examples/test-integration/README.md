# 🧪 Ejemplo de Integración Aethermind

Este ejemplo demuestra cómo conectar tus llamadas a OpenAI/Anthropic con el dashboard de Aethermind para monitorear costos en tiempo real.

## 📋 Prerrequisitos

1. Tener el servidor Aethermind corriendo (`pnpm dev:api` en la raíz del proyecto)
2. Tener el dashboard corriendo (`pnpm dev:dashboard` o `pnpm dev`)
3. Tener una API key de OpenAI o Anthropic

## 🚀 Instalación

```bash
cd examples/test-integration
pnpm install
```

## ⚙️ Configuración

1. Copia el archivo de ejemplo:

```bash
cp .env.example .env
```

2. Edita `.env` y agrega tus API keys:

```env
OPENAI_API_KEY=sk-tu-api-key-aquí
ANTHROPIC_API_KEY=sk-ant-tu-api-key-aquí
AETHERMIND_ENDPOINT=http://localhost:3001
AETHERMIND_API_KEY=test-key-local
```

## ▶️ Ejecutar

### Test con OpenAI:

```bash
pnpm test
```

### Test con Anthropic (Claude):

```bash
pnpm test:anthropic
```

## 📊 Ver Resultados

Después de ejecutar el test:

1. Abre el dashboard: http://localhost:3000
2. Ve a la sección de Costs o Traces
3. Deberías ver la llamada registrada con:
   - Modelo usado
   - Tokens consumidos
   - Costo estimado
   - Latencia

## 🔍 ¿Cómo funciona?

```
┌─────────────────┐
│   Tu Código     │ ──── openai.chat.completions.create()
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Aethermind SDK │ ──── Intercepta la llamada (sin bloquear)
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌───────┐  ┌──────────────┐
│OpenAI │  │Buffer Local  │
│  API  │  │(30s batch)   │
└───┬───┘  └──────┬───────┘
    │             │
    ▼             ▼
┌───────┐  ┌──────────────┐
│Respues│  │Aethermind API│
│  ta   │  │POST /telemetry
└───────┘  └──────┬───────┘
                  │
                  ▼
           ┌──────────────┐
           │  Dashboard   │
           │ localhost:3000
           └──────────────┘
```

## 💡 Tips

- El SDK envía datos cada 30 segundos por defecto
- Para pruebas, puedes reducir `flushInterval` a 5000 (5 segundos)
- Los datos se envían en background, nunca bloquean tu código
- Si el servidor Aethermind no está disponible, tu código sigue funcionando normal
