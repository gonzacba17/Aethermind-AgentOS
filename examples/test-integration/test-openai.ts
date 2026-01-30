/**
 * 🧪 Test de Integración Aethermind + OpenAI
 * 
 * Este script demuestra cómo conectar tus llamadas a OpenAI 
 * con el dashboard de Aethermind para monitorear costos.
 * 
 * INSTRUCCIONES:
 * 1. Copia .env.example a .env y agrega tu OPENAI_API_KEY
 * 2. Asegúrate que el servidor Aethermind esté corriendo (pnpm dev:api)
 * 3. Ejecuta: pnpm test
 * 4. Revisa el dashboard en http://localhost:3000
 */

import 'dotenv/config';
import OpenAI from 'openai';
import { initAethermind } from '@aethermind/agent';

// ============================================
// PASO 1: Inicializar Aethermind (UNA VEZ)
// ============================================
console.log('🔧 Inicializando Aethermind SDK...');

initAethermind({
  apiKey: process.env.AETHERMIND_API_KEY || 'test-key-local',
  endpoint: process.env.AETHERMIND_ENDPOINT || 'http://localhost:3001',
  // Opciones adicionales:
  // flushInterval: 5000, // Enviar datos cada 5 segundos (para ver resultados más rápido en pruebas)
  // enabled: true,       // Habilitar monitoreo
});

console.log('✅ Aethermind SDK inicializado');
console.log(`📡 Endpoint: ${process.env.AETHERMIND_ENDPOINT || 'http://localhost:3001'}`);

// ============================================
// PASO 2: Crear cliente OpenAI (NORMAL)
// ============================================
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ============================================
// PASO 3: Hacer llamadas a OpenAI (NORMAL)
// ============================================
async function runTest() {
  console.log('\n🚀 Enviando petición a OpenAI...\n');

  try {
    // Llamada simple a GPT
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'Eres un asistente útil que responde en español.' },
        { role: 'user', content: '¿Cuál es la capital de Argentina?' },
      ],
      max_tokens: 100,
    });

    console.log('📨 Respuesta de OpenAI:');
    console.log('─────────────────────────────────────');
    console.log(completion.choices[0].message.content);
    console.log('─────────────────────────────────────');
    
    // Mostrar estadísticas
    console.log('\n📊 Estadísticas de la llamada:');
    console.log(`   Modelo: ${completion.model}`);
    console.log(`   Tokens prompt: ${completion.usage?.prompt_tokens}`);
    console.log(`   Tokens respuesta: ${completion.usage?.completion_tokens}`);
    console.log(`   Tokens total: ${completion.usage?.total_tokens}`);
    
    // Estimar costo (GPT-3.5-turbo: $0.0015/1K input, $0.002/1K output)
    const inputCost = (completion.usage?.prompt_tokens || 0) * 0.0015 / 1000;
    const outputCost = (completion.usage?.completion_tokens || 0) * 0.002 / 1000;
    console.log(`   Costo estimado: $${(inputCost + outputCost).toFixed(6)}`);

    console.log('\n✅ ¡Petición completada!');
    console.log('👀 Revisa el dashboard en: http://localhost:3000');
    console.log('   Los datos aparecerán en /costs y /traces');

  } catch (error) {
    if (error instanceof Error && error.message.includes('API key')) {
      console.error('\n❌ Error: API Key de OpenAI no válida o no configurada');
      console.error('   Asegúrate de configurar OPENAI_API_KEY en el archivo .env');
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
