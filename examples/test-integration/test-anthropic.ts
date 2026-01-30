/**
 * 🧪 Test de Integración Aethermind + Anthropic (Claude)
 * 
 * Este script demuestra cómo conectar tus llamadas a Anthropic 
 * con el dashboard de Aethermind para monitorear costos.
 * 
 * INSTRUCCIONES:
 * 1. Copia .env.example a .env y agrega tu ANTHROPIC_API_KEY
 * 2. Asegúrate que el servidor Aethermind esté corriendo (pnpm dev:api)
 * 3. Ejecuta: pnpm test:anthropic
 * 4. Revisa el dashboard en http://localhost:3000
 */

import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import { initAethermind } from '@aethermind/agent';

// ============================================
// PASO 1: Inicializar Aethermind (UNA VEZ)
// ============================================
console.log('🔧 Inicializando Aethermind SDK...');

initAethermind({
  apiKey: process.env.AETHERMIND_API_KEY || 'test-key-local',
  endpoint: process.env.AETHERMIND_ENDPOINT || 'http://localhost:3001',
});

console.log('✅ Aethermind SDK inicializado');

// ============================================
// PASO 2: Crear cliente Anthropic (NORMAL)
// ============================================
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ============================================
// PASO 3: Hacer llamadas a Claude (NORMAL)
// ============================================
async function runTest() {
  console.log('\n🚀 Enviando petición a Anthropic Claude...\n');

  try {
    const message = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307', // Modelo más económico para pruebas
      max_tokens: 100,
      messages: [
        { 
          role: 'user', 
          content: '¿Cuál es la capital de Argentina? Responde en español, brevemente.' 
        },
      ],
    });

    console.log('📨 Respuesta de Claude:');
    console.log('─────────────────────────────────────');
    if (message.content[0].type === 'text') {
      console.log(message.content[0].text);
    }
    console.log('─────────────────────────────────────');
    
    // Mostrar estadísticas
    console.log('\n📊 Estadísticas de la llamada:');
    console.log(`   Modelo: ${message.model}`);
    console.log(`   Tokens input: ${message.usage.input_tokens}`);
    console.log(`   Tokens output: ${message.usage.output_tokens}`);
    
    // Estimar costo (Claude 3 Haiku: $0.25/1M input, $1.25/1M output)
    const inputCost = message.usage.input_tokens * 0.25 / 1000000;
    const outputCost = message.usage.output_tokens * 1.25 / 1000000;
    console.log(`   Costo estimado: $${(inputCost + outputCost).toFixed(6)}`);

    console.log('\n✅ ¡Petición completada!');
    console.log('👀 Revisa el dashboard en: http://localhost:3000');

  } catch (error) {
    if (error instanceof Error && error.message.includes('API key')) {
      console.error('\n❌ Error: API Key de Anthropic no válida o no configurada');
      console.error('   Asegúrate de configurar ANTHROPIC_API_KEY en el archivo .env');
    } else {
      console.error('\n❌ Error:', error);
    }
  }
}

// ============================================
// EJECUTAR
// ============================================
runTest().then(() => {
  console.log('\n⏳ Esperando 5 segundos para que los datos se envíen...');
  setTimeout(() => {
    console.log('✅ Datos enviados. Puedes cerrar este script.');
    process.exit(0);
  }, 5000);
});
