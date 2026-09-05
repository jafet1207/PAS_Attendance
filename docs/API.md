# Contrato de Interfaces y Endpoints (API)

Este documento especifica exhaustivamente todos los endpoints del backend en **Node.js + Express + TypeScript** y su interacción con el frontend React y las llamadas de automatización.

---

## 1. Módulo de Autenticación y Sesión

### `GET /api/session`
- **Descripción:** Verifica si el usuario actual cuenta con una sesión activa de coordinador.
- **Autenticación:** Pública (inspecciona cookie de sesión).
- **Respuesta Exitosa (200 OK):**
  ```json
  {
    "authenticated": true,
    "role": "coordinador"
  }
  ```
- **Respuesta No Autenticado (200 OK):**
  ```json
  {
    "authenticated": false,
    "role": null
  }
  ```

---

### `POST /api/login`
- **Descripción:** Inicia sesión validando la contraseña del coordinador.
- **Cuerpo de la Petición:**
  ```json
  {
    "password": "coordinador123"
  }
  ```
- **Respuesta Exitosa (200 OK):** Establece cookie HTTP-only `connect.sid` firmada.
  ```json
  {
    "authenticated": true,
    "role": "coordinador"
  }
  ```
- **Error de Credenciales (401 Unauthorized):**
  ```json
  {
    "error": "Contraseña incorrecta."
  }
  ```

---

### `POST /api/logout`
- **Descripción:** Cierra la sesión activa del usuario y expira la cookie.
- **Respuesta Exitosa (200 OK):**
  ```json
  {
    "authenticated": false
  }
  ```

---

## 2. Módulo de Servicios y Grupos

### `GET /api/groups`
- **Descripción:** Retorna la lista de grupos disponibles para asignación.
- **Autenticación:** Requiere sesión.
- **Respuesta Exitosa (200 OK):**
  ```json
  {
    "data": [
      { "id": 1, "name": "Servidor" },
      { "id": 2, "name": "Inducción" },
      { "id": 3, "name": "Líder" },
      { "id": 4, "name": "Director" }
    ]
  }
  ```

---

### `GET /api/services`
- **Descripción:** Retorna el listado de servicios enriquecidos con métricas de asistencia, cálculo reactivo de estado y ordenados por prioridad de atención (`Vencido` > `Pendiente` > `Cerrado` > `Completo`).
- **Autenticación:** Requiere sesión.
- **Respuesta Exitosa (200 OK):**
  ```json
  {
    "data": [
      {
        "id": 1,
        "name": "Servicio Regular Sábado 12 Setiembre",
        "type": "Regular",
        "date": "2026-09-12T09:00:00",
        "group": { "id": 1, "name": "Servidor" },
        "closingDate": "2026-09-10",
        "invited": 20,
        "confirmed": 18,
        "pending": 2,
        "confirmationPercentage": 90,
        "daysUntilClosing": 2,
        "windowOpen": true,
        "status": "Pendiente"
      }
    ]
  }
  ```

---

### `POST /api/services`
- **Descripción:** Registra un nuevo servicio eclesiástico. Valida que `fecha_cierre_confirmacion < fecha_servicio`.
- **Autenticación:** Requiere sesión.
- **Cuerpo de la Petición:**
  ```json
  {
    "fecha_servicio": "2026-09-20",
    "hora_servicio": "09:00",
    "grupo_id": 1,
    "fecha_cierre_confirmacion": "2026-09-18",
    "tipo": "Regular"
  }
  ```
- **Respuesta Exitosa (201 Created):**
  ```json
  {
    "data": { "id": 2, "name": "Servicio Regular Domingo 20 Setiembre", ... }
  }
  ```
- **Error de Validación (400 Bad Request):**
  ```json
  {
    "errors": [
      "La fecha de cierre de confirmación debe ser estrictamente anterior a la fecha del servicio."
    ]
  }
  ```

---

### `GET /api/services/:id`
- **Descripción:** Detalle de un servicio específico con la lista de participantes convocados y el resultado de su último recordatorio.
- **Autenticación:** Requiere sesión.
- **Respuesta Exitosa (200 OK):**
  ```json
  {
    "data": {
      "service": { "id": 1, ... },
      "participants": [
        {
          "id": 10,
          "name": "Carlos Santana",
          "email": "carlos@test.com",
          "status": "Sí",
          "lastDelivery": {
            "at": "2026-09-05T14:00:00Z",
            "result": "exitoso"
          }
        }
      ]
    }
  }
  ```

---

### `GET /api/services/:id/submissions`
- **Descripción:** Historial cronológico de todos los intentos de recordatorios enviados para el servicio.
- **Autenticación:** Requiere sesión.
- **Respuesta Exitosa (200 OK):**
  ```json
  {
    "data": {
      "service": { "id": 1, ... },
      "submissions": [
        {
          "id": 1,
          "participantName": "Carlos Santana",
          "number": 1,
          "at": "2026-09-05T14:00:00Z",
          "result": "exitoso"
        }
      ]
    }
  }
  ```

---

## 3. Módulo de Servidores y Participantes

### `GET /api/participants`
- **Descripción:** Lista de todos los servidores registrados con su grupo y rol actual.
- **Query Params:** `service_id` (opcional).
- **Autenticación:** Requiere sesión.
- **Respuesta Exitosa (200 OK):**
  ```json
  {
    "data": [
      {
        "id": 10,
        "name": "Carlos Santana",
        "email": "carlos@test.com",
        "group": { "id": 1, "name": "Servidor" }
      }
    ]
  }
  ```

---

### `POST /api/participants`
- **Descripción:** Da de alta un nuevo servidor validando unicidad de correo.
- **Autenticación:** Requiere sesión.
- **Cuerpo de la Petición:**
  ```json
  {
    "name": "María Rojas",
    "email": "maria@test.com",
    "groupId": 1
  }
  ```
- **Respuesta Exitosa (201 Created):**
  ```json
  {
    "data": { "id": 11, "name": "María Rojas", "email": "maria@test.com", "group": { "id": 1, "name": "Servidor" } }
  }
  ```
- **Error de Correo Duplicado (409 Conflict):**
  ```json
  {
    "errors": ["Ya existe un participante registrado con este correo electrónico."]
  }
  ```

---

### `PATCH /api/participants/:id/role`
- **Descripción:** Modifica el grupo o rol asignado a un participante.
- **Autenticación:** Requiere sesión.
- **Cuerpo de la Petición:**
  ```json
  {
    "groupId": 2
  }
  ```
- **Respuesta Exitosa (200 OK):**
  ```json
  {
    "data": {
      "id": 10,
      "group": { "id": 2, "name": "Inducción" }
    }
  }
  ```

---

## 4. Módulo de Confirmación Pública (Enlaces de Correo)

### `GET /confirm/:token`
- **Descripción:** Página web accesible para que el participante confirme asistencia o revise su estado.
- **Autenticación:** Token HMAC/JWT (7 días de vigencia).
- **Respuesta (200 OK):** Renderiza HTML responsivo. Si la ventana está cerrada, muestra aviso informativo.

---

### `POST /confirm/:token`
- **Descripción:** Registra o actualiza la respuesta del participante (`Sí` o `No`).
- **Autenticación:** Token HMAC/JWT.
- **Cuerpo:** `{ "respuesta": "Sí" | "No" }` o formulario urlencoded.
- **Respuesta:** HTML de confirmación exitosa con hora de llegada y datos del servicio.

---

### `GET /confirm/:token/:accion`
- **Descripción:** Confirmación rápida de un solo clic desde los botones del correo (`/confirm/:token/si` o `/confirm/:token/no`).
- **Respuesta:** HTML de confirmación exitosa o ventana cerrada si expiró.

---

## 5. Módulo de Automatización y Recordatorios

### `GET` / `POST /api/enviar-recordatorios`
- **Descripción:** Ejecuta el ciclo diario de recordatorios para participantes sin respuesta.
- **Autenticación:** Sesión activa de coordinador o header `Authorization: Bearer <CRON_SECRET>`.
- **Respuesta Exitosa (200 OK):**
  ```json
  {
    "servicios_procesados": 2,
    "participantes_evaluados": 35,
    "recordatorios_exitosos": 12,
    "recordatorios_fallidos": 0,
    "ya_completados": 5,
    "ya_confirmados": 18
  }
  ```
