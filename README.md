# bissú Capacity & Horarios - Sistema de Gestión Operativa

Aplicación web ultra ligera, rápida y optimizada para la gestión de capacidad, asistencia y programación de horarios por tienda de **bissú ACCESORIOS**.

---

## 🚀 Características Principales

### 1. 📊 Módulo de Capacity & Asistencia
- **Matriz Interactiva estilo Hoja de Cálculo**: Visualización por colaborador y días del mes.
- **Edición Ultra Rápida**: Cambio dinámico de valores (`1.0`, `0.5`, `0.0`) con notificaciones en tiempo real (*Toast notifications*).
- **Métricas y KPIs**: Resumen en tiempo real de colaboradores activos, porcentaje promedio de capacity, asistencias completas y días trabajados.

### 2. 📅 Módulo de Gestión de Horarios
- **Planificación Independiente de Horarios**: Espacio dedicado para la programación operativa mensual.
- **Control de Ciclo de Vida (`BORRADOR` vs `ENVIADO`)**:
  - Mientras el horario está en `BORRADOR`, la tienda puede editar libremente los turnos.
  - Al hacer clic en **Enviar Horario**, el período pasa a estado `ENVIADO` y se bloquea para evitar ediciones accidentales o no autorizadas por la tienda.
- **Flujo de Solicitudes y Permisos de Reapertura**:
  - Si una tienda necesita ajustar un horario ya enviado (ej. emergencias de personal), puede enviar una **Solicitud de Permiso** indicando el motivo.
  - Los roles administrativos (`ADMIN`, `SUPERVISOR`, `RRHH`) cuentan con una **Bandeja de Solicitudes** para revisar, aprobar o rechazar peticiones. Al aprobar, el período vuelve a `BORRADOR` permitiendo modificaciones a la sede.

### 3. 👥 Gestión de Colaboradores y Alta Rotación
- **Control de Personal**: Registro de colaboradores por DNI, código de asesor, nombre, puesto (Encargada, Asesor de ventas, Cajera), régimen (`FT` o `PT`), celular y correo corporativo.
- **Manejo de Bajas**: Soporte para marcar fecha de baja / estado inactivo, previniendo apariciones inconsistentes en matrices de meses posteriores a su retiro.

### 4. 🔒 Aislamiento por Tienda (Row-Level Security - RLS)
- Validación estricta en el backend: cada cuenta de rol `TIENDA` solo puede visualizar y modificar los datos de su propia sede.
- Los roles de gestión (`ADMIN`, `SUPERVISOR`, `RRHH`) poseen acceso consolidado a todas las sedes mediante un selector interactivo de tiendas.

### 5. 📈 Exportación Directa a Power Query / Power BI
- Endpoint `/api/capacity/export` protegido por API Key.
- Devuelve la matriz desdinamizada (*unpivoted*) lista para ser consumida directamente en Excel o Power BI sin transformaciones manuales de limpieza.

### 6. 🐘 Base de Datos Única: PostgreSQL
- **Un solo motor**: el proyecto corre exclusivamente sobre **PostgreSQL**, en desarrollo y en producción.
- **Sin arranque silencioso**: si falta `DATABASE_URL`, la aplicación falla de inmediato con un mensaje claro en lugar de levantar una base vacía por error.

---

## 🛠️ Requisitos Previos

- **Node.js**: v18.0 o superior.
- **PostgreSQL**: v14 o superior (**obligatorio**). La aplicación no arranca sin una conexión configurada.

---

## 💻 Inicio Rápido Local

1. **Instalar dependencias**:
   ```bash
   npm install
   ```

2. **Construir el frontend** (genera `dist/`, que Fastify sirve como estático):
   ```bash
   npm run build
   ```

3. **Iniciar el servidor**:
   - Modo Producción:
     ```bash
     npm start
     ```
   - Modo Desarrollo (backend con recarga automática):
     ```bash
     npm run dev
     ```

4. **Acceder a la aplicación**:
   - **App Principal**: [http://localhost:3000](http://localhost:3000)
   - **Pantalla de Login**: [http://localhost:3000/login](http://localhost:3000/login)

### Desarrollo del frontend con hot-reload

El frontend (React + Vite, en `client/`) también puede correr con su propio servidor de desarrollo, que hace proxy de `/api` hacia Fastify:

```bash
npm run dev          # Terminal 1: backend Fastify en :3000
npm run dev:client   # Terminal 2: Vite en :5173, con hot-reload
```

Con este flujo, abre [http://localhost:5173](http://localhost:5173) mientras desarrollas; `npm run build` sigue siendo necesario antes de usar `npm start`/`npm run dev` solos (sin Vite), ya que Fastify sirve el build de `dist/`.

---

## 🔑 Credenciales de Demostración

> **Contraseña por defecto para todas las cuentas de prueba:** `123456`

| Rol | Correo Electrónico | Alcance y Permisos |
| :--- | :--- | :--- |
| **Tienda (Jesús María)** | `bissujesusmaria@bissu.pe` | Gestión exclusiva de la tienda Jesús María. |
| **Tienda (Chiclayo)** | `bissuchiclayo@bissu.pe` | Gestión exclusiva de la tienda Chiclayo. |
| **Tienda (Porongoche)** | `bissuporongoche@bissu.pe` | Gestión exclusiva de la tienda Porongoche AQP. |
| **Administrador** | `admin@bissu.pe` | Acceso global a todas las tiendas, aprobaciones y exportación Power BI. |
| **Supervisor** | `supervisor@bissu.pe` | Supervisión global, cambio de tiendas y aprobación de permisos. |
| **Recursos Humanos** | `rrhh@bissu.pe` | Gestión global de colaboradores, horarios y solicitudes. |

---

## 🌐 API & Endpoints

### 🔐 Autenticación (`/api/auth`)
- `POST /api/auth/login`: Iniciar sesión (recibe `email` y `password`, retorna JWT).
- `GET /api/auth/me`: Verificar sesión actual del usuario autenticado.

### 🏬 Tiendas y Capacity (`/api/capacity`)
- `GET /api/tiendas`: Lista de todas las tiendas (selectores).
- `GET /api/capacity?mes=YYYY-MM&id_tienda=X`: Obtener matriz de capacity por tienda y mes.
- `PUT /api/capacity/bulk-update`: Actualizar registros de capacity en lote.
- `GET /api/capacity/export?mes=YYYY-MM&api_key=KEY`: Endpoint público desdinamizado para Power Query / Power BI.
- `POST /api/empleados`: Crear un nuevo colaborador.
- `PUT /api/empleados/:id`: Actualizar datos o dar de baja a un colaborador.

### 👤 Usuarios (`/api/usuarios`) — Solo ADMIN
- `GET /api/usuarios`: Lista todos los usuarios (sin exponer la contraseña).
- `POST /api/usuarios`: Crea un usuario (`email`, `password`, `rol`, `id_tienda` si el rol es `TIENDA`).
- `PUT /api/usuarios/:id`: Cambia el rol y/o la tienda asignada.
- `POST /api/usuarios/:id/reset-password`: Restablece la contraseña de un usuario.
- `POST /api/usuarios/:id/toggle-activo`: Activa o desactiva una cuenta (bloquea el login sin eliminar el usuario ni su historial).

### 📅 Horarios (`/api/horarios`)
- `GET /api/horarios?mes=YYYY-MM&id_tienda=X`: Obtener matriz de horarios y estado del período (`BORRADOR` / `ENVIADO`).
- `PUT /api/horarios/bulk-update`: Actualizar turnos de horarios (bloqueado si el período está `ENVIADO` para rol `TIENDA`).
- `POST /api/horarios/enviar`: Bloquear el horario del mes pasando el estado a `ENVIADO`.
- `POST /api/horarios/solicitar-permiso`: Enviar solicitud con motivo para reabrir edición de un horario enviado.
- `GET /api/horarios/solicitudes?estado=PENDIENTE`: Listar solicitudes de permisos.
- `POST /api/horarios/solicitudes/:id/resolver`: Aprobar (reabre a `BORRADOR`) o rechazar la solicitud (solo ADMIN/SUPERVISOR/RRHH).

---

## 🗄️ Base de Datos

El sistema usa **PostgreSQL** como único motor. No hay respaldo local ni base
embebida: si `DATABASE_URL` no está definida, el servidor no arranca.

### 1. Configuración de Variables de Entorno (`.env`)

```env
PORT=3000
HOST=0.0.0.0
JWT_SECRET=cambia_esto_por_un_valor_propio
API_KEY_EXPORT=clave_para_power_query

# Obligatoria. Sin esto la aplicación no levanta.
DATABASE_URL=postgresql://postgres:tu_password@localhost:5432/bissu_capacity
```

> El archivo `.env` está en `.gitignore` y **nunca debe subirse al repositorio**:
> contiene la contraseña de la base y el secreto de firma de los tokens.

### 2. Crear el esquema

```bash
createdb bissu_capacity
psql -U postgres -d bissu_capacity -f db/schema.sql
psql -U postgres -d bissu_capacity -f db/seed.sql   # datos de ejemplo, opcional
```

> ⚠️ `db/schema.sql` **empieza borrando todas las tablas** (`DROP TABLE ... CASCADE`).
> Sirve para crear una base desde cero, nunca para actualizar una que ya tenga datos.

### 3. Cambios de esquema sobre una base con datos

El proyecto **no tiene sistema de migraciones**. Para modificar una base en uso se
aplican sentencias `ALTER TABLE` a mano y luego se refleja el cambio en
`db/schema.sql`, que es la referencia del estado actual. Ejemplo:

```sql
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS horas_semana NUMERIC(5,2) NULL;
```

Conviene respaldar antes de tocar una base con información real:

```bash
pg_dump -U postgres bissu_capacity > respaldo_$(date +%F).sql
```

### 4. Tablas

| Tabla | Para qué sirve |
|---|---|
| `tiendas` | Sedes: tipo `TIENDA`, `OFICINA` o `LOGISTICA`. Las tiendas llevan código de almacén y rango de códigos de vendedor. |
| `usuarios` | Cuentas de acceso. `email` para Admin/Supervisor, `username` para cuentas de sede. `id_empleado` marca las cuentas personales de Oficina/Logística; si es nulo, es la cuenta compartida de la sede. |
| `usuarios_auditoria` | Historial de cambios sobre cuentas. Guarda copia del identificador para que el registro sobreviva a la eliminación de la cuenta. |
| `empleados` | Colaboradores. `regimen` (FT/PT) define la dotación, `horas_semana` la jornada pactada y `situacion` incluye `NO_COMISIONA`. |
| `empleado_novedades` | Vacaciones, descanso médico, faltas, permisos y licencias, por rango de fechas. |
| `capacity_diario` | Un registro por colaborador y día: 1 si trabajó en franja comercial, 0 si no. Se llena solo desde el horario oficial. |
| `horario_turnos` | Turnos del horario vigente. Varias filas por día permiten turnos partidos; un turno puede cruzar medianoche. |
| `horario_semanas` | Marca qué semana de qué tienda ya está confirmada como oficial. |
| `horario_solicitudes` | Solicitudes de cambio de horario, con estado y número de `version` para control de concurrencia. |
| `horario_solicitud_dias` / `_turnos` | Detalle de lo propuesto en cada solicitud. |
| `horarios_diario` | Tabla heredada, sin uso. |

### 5. Cómo se relacionan Horarios y Capacity

El capacity **no se llena a mano**. Cuando un Admin/Supervisor/RRHH aprueba el
horario de una semana, en esa misma transacción se marca cada día con 1 o 0
según haya turno en franja comercial (07:00–23:59). Los turnos íntegramente de
madrugada —mantenimiento, remodelación, correctivos— suman horas en el horario
pero no generan día de venta, así que no cuentan para el bono.

### 6. Importación Masiva desde Excel

```bash
python db/import_real_data.py
```

> ⚠️ Este script todavía escribe a SQLite y **quedó obsoleto** tras el paso a
> PostgreSQL. Se conserva porque contiene la lógica de lectura de las plantillas
> de Excel; hay que adaptarlo antes de volver a usarlo.

---

## 📊 Integración con Power Query / Power BI

Para sincronizar automáticamente Power BI o Excel con los datos de Capacity:

1. En la aplicación web, accede como Administrador y usa el botón **Power Query BI** de la barra superior: ahí se arma la URL con la clave real.
2. La forma de la URL es:
   ```text
   http://localhost:3000/api/capacity/export?mes=2026-08&api_key=<API_KEY_EXPORT>
   ```
   Reemplaza `<API_KEY_EXPORT>` por el valor de tu `.env`. **No pegues la clave
   en este README ni en ningún archivo del repositorio.**
3. En **Power BI Desktop** o **Excel**:
   - Ir a `Obtener Datos` ➔ `Desde la Web`.
   - Pegar la URL y seleccionar `Aceptar`.
4. El conjunto de datos incluye las columnas desdinamizadas:
   - `fecha`, `dni`, `codigo_empleado`, `nombre_empleado`, `puesto`, `regimen`,
     `dotacion`, `situacion`, `comisiona`, `codigo_almacen`, `nombre_tienda`,
     `valor`, `semana_oficial`, `fecha_actualizacion`.

> Preferible: enviar la clave en la cabecera `Authorization: Bearer <API_KEY_EXPORT>`
> en lugar de la query string, que queda registrada en logs y proxies. Para
> consumos nuevos existe además la API versionada `/api/v1/capacity/resumen`,
> que entrega una fila por colaborador con los días trabajados ya calculados.

---

## 📁 Estructura del Proyecto

```text
├── package.json
├── vite.config.js             # Config de Vite (root: client/, build.outDir: ../dist)
├── tailwind.config.js
├── postcss.config.js
├── .env.example
├── dist/                      # Build de producción del frontend (generado, servido por Fastify)
├── db/
│   ├── schema.sql             # Esquema PostgreSQL de referencia. Crea desde cero: borra las tablas al inicio
│   ├── seed.sql               # Datos iniciales (Tiendas, Usuarios, Empleados, Matriz)
│   └── import_real_data.py    # Importación desde plantillas Excel (obsoleto: aún escribe a SQLite)
├── src/
│   ├── app.js                 # Punto de entrada Fastify: plugins, error handler global, registro de rutas,
│   │                           # servido de dist/ + fallback SPA para rutas del cliente
│   ├── config/
│   │   └── db.js              # Conexión a PostgreSQL: pool, query() y withTransaction()
│   ├── errors/
│   │   └── AppError.js        # Error tipado con statusCode, usado por los servicios
│   ├── middleware/
│   │   ├── auth.js            # Autenticación JWT y validación de API Key para exportación
│   │   └── roles.js           # ROLES_ADMIN + requireRole(...roles) reutilizable
│   ├── repositories/          # Acceso a datos: todo el SQL vive aquí (usa config/db.js#query)
│   │   ├── tiendasRepository.js
│   │   ├── usuariosRepository.js
│   │   ├── empleadosRepository.js
│   │   ├── capacityRepository.js
│   │   └── horariosRepository.js
│   ├── services/               # Reglas de negocio y RLS por tienda/rol
│   │   ├── authService.js
│   │   ├── usuariosService.js
│   │   ├── capacityService.js
│   │   └── horariosService.js
│   ├── routes/                 # Controladores delgados: validación de esquema + llamada al servicio
│   │   ├── auth.js             # /api/auth
│   │   ├── capacity.js         # /api/capacity, /api/tiendas, /api/empleados
│   │   ├── horarios.js         # /api/horarios
│   │   └── usuarios.js         # /api/usuarios (gestión de usuarios, solo ADMIN)
│   └── utils/
│       └── dates.js            # Utilidades para cálculo de días en meses
├── client/                     # Frontend: React + Vite (SPA modular, code-splitting por ruta)
│   ├── index.html
│   └── src/
│       ├── main.jsx            # Entry point: providers globales (Router, React Query, Auth, Toast, Confirm)
│       ├── App.jsx             # Rutas (react-router), lazy loading por módulo
│       ├── api/                # Cliente HTTP + funciones por dominio (auth, tiendas, capacity, horarios, usuarios)
│       ├── auth/                # AuthContext, ProtectedRoute, RoleGuard
│       ├── components/          # UI compartida: Header, Sidebar, SaveBar, StoreSelector
│       ├── hooks/                # useToast, useConfirm
│       ├── features/
│       │   ├── login/           # LoginPage
│       │   ├── capacity/        # Tabla de asistencia, KPIs, modal de colaborador, ciclo de valores
│       │   ├── horarios/        # Grilla semanal, modal de turno, solicitudes, día de descanso
│       │   └── usuarios/        # CRUD de usuarios (solo ADMIN)
│       └── styles/index.css     # Tailwind + tema Antigravity para bissú
└── README.md
```

