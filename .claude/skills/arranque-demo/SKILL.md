---
name: arranque-demo
description: Prepara y levanta PAS Attendance para una demostración en vivo — verifica la configuración, siembra datos sintéticos (grupos, servidores y servicios de ejemplo) si hacen falta, arranca el backend y el frontend, y deja al usuario la URL y la contraseña para entrar. Usar cuando el usuario pida "levantar la demo", "preparar el sistema para mostrar", "arrancar el proyecto para presentar" o equivalentes. No usar para desarrollo cotidiano (ahí basta `npm run dev:backend` / `dev:frontend` directo) ni para correr las pruebas.
---

# Arranque para demostración

Dejar PAS Attendance listo para recorrerse de punta a punta frente a alguien, partiendo de un
clon limpio del repositorio, sin que el usuario tenga que ejecutar nada a mano.

## Pasos

1. **Verificar configuración.** Si `backend/.env` no existe, copiar `.env.example` de la raíz a
   `backend/.env` y avisar al usuario que debe completar `DATABASE_URL` (Neon u otro Postgres)
   antes de continuar — sin eso no hay a dónde sembrar datos ni servidor que arrancar. Si
   `DATABASE_URL` está vacía o comentada, detenerse aquí y pedirla.

2. **Instalar dependencias si hace falta.** Si no existen `backend/node_modules` o
   `frontend/node_modules`, correr `npm install` en la carpeta correspondiente.

3. **Sembrar datos de demostración.** Desde la raíz del repositorio:

   ```bash
   npm run seed:demo
   ```

   Esto aplica el esquema de base de datos (idempotente, lo hace también el propio servidor al
   arrancar) y crea, si no existen ya, 8 servidores sintéticos repartidos en los 4 grupos
   (Servidor, Inducción, Líder, Director) y 2 servicios de ejemplo: uno con la ventana de
   confirmación abierta y otro ya vencido, para que el dashboard muestre variedad de estados.
   Es seguro correrlo varias veces: los correos y servicios que ya existen se omiten, no se
   duplican. Revisar el archivo `backend/src/scripts/seedDemo.ts` si se necesita ajustar los
   datos sembrados.

4. **Levantar el backend y el frontend**, cada uno en su propio proceso en segundo plano:

   ```bash
   npm run dev:backend
   npm run dev:frontend
   ```

   Esperar a que el backend confirme `Servidor corriendo en http://localhost:5000` antes de dar
   por lista la demo (el frontend depende de que el backend ya esté arriba, por el proxy de Vite
   hacia `/api`).

5. **Reportar al usuario, en un mensaje corto:**
   - La URL para entrar: `http://localhost:5173`.
   - La contraseña de coordinador: el valor de `COORDINADOR_PASSWORD` en `backend/.env`
     (`coordinador123` si no se cambió el valor de `.env.example`).
   - Un recorrido sugerido de 3 pasos: entrar → "Servicios" (ver el servicio con ventana abierta
     y el vencido) → "Servidores" (ver los 8 sembrados en sus 4 grupos).
   - Si se quiere demostrar el envío de recordatorios sin esperar al cron, el comando de
     `README.md` (`curl ... /api/enviar-recordatorios` con `CRON_SECRET`).

## Notas

- No usar datos reales en ningún caso: los correos sembrados son sintéticos
  (`@ejemplo-sintetico.test`), igual que en las pruebas automatizadas del proyecto.
- Este skill no reemplaza las pruebas automatizadas (`npm test`) ni un despliegue: es solo para
  dejar el sistema navegable en un entorno local o de demo.
- Si `npm run seed:demo` falla por falta de conexión a la base de datos, no intentar "arreglarlo"
  con datos en memoria ni con otro almacenamiento: el proyecto exige persistencia real en
  PostgreSQL (ver `CLAUDE.md`); el problema es la configuración de `DATABASE_URL`, no el código.
