import { defineConfig } from 'vitest/config';

// Las pruebas de este proyecto son de integración contra una base de datos real compartida
// (TEST_DATABASE_URL), sin aislamiento entre archivos (ver comentarios en tests/etapa*.test.ts).
// Con la concurrencia por defecto de Vitest, dos archivos de prueba insertando participantes al
// mismo tiempo pueden hacer que un conteo leído en dos consultas separadas dentro de una misma
// petición HTTP (p. ej. GET /api/services/:id) no coincida, aunque cada prueba sea correcta por
// separado. Se desactiva el paralelismo entre archivos para que la suite sea determinista.
export default defineConfig({
  test: {
    fileParallelism: false,
    // Crea/actualiza el esquema una sola vez antes de toda la suite. Necesario en integración
    // continua, donde el runner arranca con una base de datos efímera y vacía (ver el comentario
    // en tests/globalSetup.ts). Es idempotente: no afecta a un entorno donde el esquema ya existe.
    globalSetup: './tests/globalSetup.ts',
  },
});
