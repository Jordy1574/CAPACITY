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

### 6. 🔄 Dualidad de Base de Datos y Sincronización Automática
- **Desarrollo sin Fricción**: Respaldo automático en **SQLite** local (`db/capacity.db`) si no se define `DATABASE_URL`.
- **Sincronización a PostgreSQL**: Script automatizado (`db/sync_to_postgres.js`) para migrar y sincronizar datos locales a instancias PostgreSQL en producción de forma transparente.

---

## 🛠️ Requisitos Previos

- **Node.js**: v18.0 o superior.
- **Python**: 3.x (opcional, para ejecutar scripts de importación masiva desde Excel).
- **PostgreSQL**: v14 o superior (opcional; si no está configurado, el sistema usará SQLite local).

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

## 🗄️ Base de Datos y Sincronización

### 1. Configuración de Variables de Entorno (`.env`)

Crea un archivo `.env` basado en `.env.example`:
```env
PORT=3000
HOST=0.0.0.0
JWT_SECRET=bissu_capacity_secret_key_2026_super_secure
API_KEY_EXPORT=bissu_power_query_key_98765

# Descomenta para usar PostgreSQL en lugar de SQLite local:
# DATABASE_URL=postgresql://postgres:tu_password@localhost:5432/bissu_capacity
```

### 2. Migración y Sembrado Manual PostgreSQL
```bash
psql -U postgres -d bissu_capacity -f db/schema.sql
psql -U postgres -d bissu_capacity -f db/seed.sql
```

### 3. Sincronizador SQLite ➔ PostgreSQL
Para sincronizar automáticamente los datos de la base de datos local SQLite (`db/capacity.db`) con tu base de datos PostgreSQL:
```bash
node db/sync_to_postgres.js
```

### 4. Importación Masiva desde Excel
Para actualizar los registros a partir de las plantillas oficiales Excel:
```bash
python db/import_real_data.py
```

---

## 📊 Integración con Power Query / Power BI

Para sincronizar automáticamente Power BI o Excel con los datos de Capacity:

1. En la aplicación web, accede como Administrador o usa el botón **Power Query BI** en la barra superior.
2. Copia la URL de exportación:
   ```text
   http://localhost:3000/api/capacity/export?mes=2026-08&api_key=bissu_power_query_key_98765
   ```
3. En **Power BI Desktop** o **Excel**:
   - Ir a `Obtener Datos` ➔ `Desde la Web`.
   - Pegar la URL y seleccionar `Aceptar`.
4. El conjunto de datos incluye las columnas desdinamizadas:
   - `fecha`, `dni`, `codigo_empleado`, `nombre_empleado`, `puesto`, `regimen`, `codigo_almacen`, `nombre_tienda`, `valor`.

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
│   ├── schema.sql             # Definición de tablas PostgreSQL (Capacity, Horarios, Solicitudes)
│   ├── seed.sql               # Datos iniciales (Tiendas, Usuarios, Empleados, Matriz)
│   ├── capacity.db            # Base de datos SQLite de respaldo local
│   ├── sync_to_postgres.js    # Sincronizador automatizado SQLite -> PostgreSQL
│   └── import_real_data.py    # Script de importación desde plantillas Excel
├── src/
│   ├── app.js                 # Punto de entrada Fastify: plugins, error handler global, registro de rutas,
│   │                           # servido de dist/ + fallback SPA para rutas del cliente
│   ├── config/
│   │   └── db.js              # Controlador dual de base de datos (PostgreSQL / SQLite)
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

