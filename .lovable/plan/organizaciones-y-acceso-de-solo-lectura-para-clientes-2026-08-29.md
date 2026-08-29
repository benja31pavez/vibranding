# Organizaciones y acceso de solo lectura para clientes

Hoy la seguridad depende de `owns_client()` (`clients.user_id = auth.uid()`), hay un solo usuario y los clientes no pueden entrar. Este cambio introduce equipos y un acceso limitado para el cliente final.

## 1. Estructura de equipos

- `orgs` (nombre, dueño inicial).
- `org_members(user_id, org_id, role)` con rol en `owner`, `admin`, `agent`, `viewer`.
- `clients.org_id` nuevo, NOT NULL, rellenado desde el dueño actual: se crea una organización por cada usuario existente y se asignan sus clientes.

## 2. Función de pertenencia

`user_orgs()` devuelve los `org_id` del usuario autenticado leyendo `org_members`. SECURITY DEFINER, STABLE, `search_path = ''`. Evita recursión en las políticas.

## 3. Reescritura de RLS

Todas las tablas de datos de cliente pasan de `owns_client(client_id)` a pertenencia por organización, manteniendo cuatro políticas separadas por tabla (ver, crear, editar, borrar):

```text
antes:  owns_client(client_id)
después: client_id IN (SELECT id FROM clients WHERE org_id IN (SELECT org_id FROM user_orgs()))
```

- Editar y borrar quedan limitados a `owner` y `admin` en las tablas sensibles (pagos, contratos, cuentas conectadas).
- Se conservan tal cual las excepciones públicas ya existentes: landing pages publicadas, multienlaces publicados, formularios de contacto, reservas por slug y webhooks.
- Entrego la tabla completa antes/después de políticas al aplicar la migración.

## 4. Acceso de solo lectura para el cliente

- `client_users(user_id, client_id)`: un usuario de auth ligado a un único cliente.
- Solo lectura y solo de su propio cliente: analítica, etapas (deliverables) y objetivos.
- Sin acceso a pagos, contratos, otros clientes ni bandeja de WhatsApp (ninguna política los alcanza).
- Función `user_client_id()` (SECURITY DEFINER, STABLE) para usarla en las políticas de lectura.

## 5. Flujo de invitación

- Desde la ficha del cliente: "Invitar cliente" con su correo.
- Server function con privilegios crea el usuario, lo liga en `client_users` y envía el correo de invitación.
- El cliente define su contraseña y entra directo a su página de analítica en una vista reducida (sin barra lateral de agencia).

## Detalles técnicos

- Todo en migraciones: `orgs`, `org_members`, `client_users`, `clients.org_id`, funciones y reemplazo de políticas, con GRANT explícitos por tabla.
- Backfill idempotente: una org por usuario dueño de clientes, rol `owner`.
- La invitación usa la API de administración de auth desde el servidor, nunca desde el navegador.
- Rutas nuevas: layout de cliente invitado con su analítica, etapas y objetivos en modo lectura.
- `owns_client()` se mantiene temporalmente como envoltorio compatible y se elimina al final, cuando ninguna política la use.
