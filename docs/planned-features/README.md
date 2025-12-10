# Planned Features

Esta carpeta contiene documentación de features planificados o parcialmente implementados que aún no están disponibles en producción.

## 📋 Estado de Features

| Feature | Estado | Prioridad | Timeline |
|---------|--------|-----------|----------|
| **USAGE_LIMITS.md** | 🔴 No implementado | Alta | Q1 2026 |
| **JWT_AUTH.md** | 🟡 Parcialmente implementado | Media | Q4 2025 |

## 🔴 No Implementado

### Usage Limits
Sistema de límites de ejecución basado en planes de suscripción.

**Estado actual**: No implementado  
**Funcionalidad actual**: Sin límites de uso  
**Roadmap**: Ver [../roadmap.md](../roadmap.md) - Fase 3, Month 4

## 🟡 Parcialmente Implementado

### JWT Authentication
Sistema de autenticación basado en JSON Web Tokens.

**Estado actual**: 
- ✅ API Key authentication (funcional y recomendado)
- ⚠️ JWT endpoints documentados pero no implementados
- ❌ Signup/Login/Reset password no disponibles

**Funcionalidad actual**: 
- Usa `X-API-Key` header para autenticación
- Genera API keys con: `pnpm generate-api-key`

**Próximos pasos**: Implementación completa de JWT prevista para Q4 2025

## 📚 Documentación Actual

Para features ya implementados, consulta:
- [../API.md](../API.md) - Documentación de la API actual
- [../SECURITY.md](../SECURITY.md) - Políticas de seguridad
- [../README.md](../README.md) - Guía principal del usuario

## 🗺️ Roadmap

Para ver el roadmap completo del proyecto, consulta [../roadmap.md](../roadmap.md).
