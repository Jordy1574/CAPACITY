# bissú Capacity & Horarios - Sistema de Gestión Operativa

Aplicación web ultra ligera, rápida y optimizada para la gestión de capacidad, asistencia y programación de horarios por tienda de **bissú ACCESORIOS**.

---

## 🚀 Características Principales

### 1. 📊 Módulo de Capacity & Asistencia
- **Se llena solo desde el horario**: al aprobarse la semana, cada día queda en `1` o `0`. Las celdas son de solo lectura; ya no se cargan a mano.
- **Solo cuenta la venta**: un turno que toca la franja comercial (07:00–23:59) marca `1`. Los de madrugada —mantenimiento, remodelación— suman horas en el horario pero no generan día de venta.
- **Dotación por persona**: Full Time `1`, Part Time `0.5`. El estado `NO_COMISIONA` trabaja pero queda siempre en `0`.
- **Métricas y KPIs**: colaboradores activos, promedio de capacity, turnos completos y registros del período.

### 2. 📅 Módulo de Gestión de Horarios
- **Planificación semanal por turnos**: varios bloques por día (turnos partidos, donde el hueco es el refrigerio y no suma horas) y turnos que cruzan la medianoche. La grilla se estira sola si la sede abre más temprano o cierra de madrugada.
- **Ciclo de vida de la semana**: mientras no esté confirmada, la tienda edita en vivo. Una vez **oficial**, los cambios pasan por una solicitud que Admin/Supervisor/RRHH aprueba; el oficial no se mueve hasta entonces.
- **La tienda puede corregir su solicitud** mientras siga pendiente, o descartarla y rehacerla desde el oficial. Un número de versión impide que se apruebe contenido viejo si la tienda lo modificó durante la revisión.
- **Control para RRHH**: jornada pactada por colaborador (FT 48h, PT 23.5h, editables) con cálculo de horas extra, día de descanso reflejado en la grilla, y novedades por rango de fechas (vacaciones, descanso médico, faltas, permisos, licencias).
- **Salidas**: el mes completo a Excel con una hoja por semana, y la semana como imagen para compartir o imprimir.

### 3. 👥 Gestión de Colaboradores y Alta Rotación
- **Control de Personal**: Registro de colaboradores por DNI, código de asesor, nombre, puesto (Encargada, Asesor de ventas, Cajera), régimen (`FT` o `PT`), celular y correo corporativo.
- **Manejo de Bajas**: Soporte para marcar fecha de baja / estado inactivo, previniendo apariciones inconsistentes en matrices de meses posteriores a su retiro.

### 4. 🔒 Aislamiento por Tienda (Row-Level Security - RLS)
- Validación estricta en el backend: cada cuenta de rol `TIENDA` solo puede visualizar y modificar los datos de su propia sede.
- Los roles de gestión (`ADMIN`, `SUPERVISOR`, `RRHH`) poseen acceso consolidado a todas las sedes mediante un selector interactivo de tiendas.

### 5. 📈 API de consumo para Power BI y otros sistemas
- `/api/v1/capacity/resumen` entrega una fila por colaborador con los días trabajados ya calculados **y el detalle día por día en 1 / 0**, listo para liquidar bonos sin rehacer la suma.
- Distingue un `0` de "no trabajó" de un `null` de "esa semana aún no se aprueba", para no calcular sobre datos incompletos.
- Protegido por API Key en la cabecera `Authorization`.

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
- `POST /api/auth/login`: Recibe `identificador` y `password`, retorna JWT. El identificador puede ser el correo personal (Admin/Supervisor), el username autogenerado (cuentas de sede) o el correo oficial de la tienda.
- `GET /api/auth/me`: Verificar sesión actual.

### 📈 API de consumo (`/api/v1`) — para Power BI, Excel u otros sistemas
Autenticación: `Authorization: Bearer <API_KEY_EXPORT>` (también se acepta `?api_key=` por compatibilidad).

- `GET /api/v1/capacity/resumen?mes=YYYY-MM[&id_tienda=X]`
  Una fila por colaborador con todo lo necesario para liquidar bonos:
  `dni`, `nombre`, `puesto`, `regimen`, `dotacion` (FT 1 / PT 0.5), `situacion`,
  `comisiona`, tienda, `dias_trabajados` ya sumados, y el detalle día por día en
  `dias`: `{ "2026-09-01": 1, "2026-09-02": 0, "2026-09-07": null, ... }`
  donde **1** = trabajó, **0** = no trabajó y **null** = todavía sin dato porque
  esa semana no se ha aprobado. Incluye todos los días del mes.
  Trae además `dias_oficiales` y `mes_completo` para saber si la cifra ya es
  definitiva o aún puede cambiar.

- `GET /api/v1/capacity/diario?mes=YYYY-MM[&id_tienda=X]`
  Formato largo, una fila por colaborador y día, pensado para tablas dinámicas.
  A diferencia de `resumen`, solo devuelve los días que tienen registro.

### 🏬 Tiendas y Capacity (`/api/capacity`)
- `GET /api/tiendas`: Lista de sedes (selectores).
- `POST /api/tiendas` · `PUT /api/tiendas/:id`: Crear y editar sedes (solo ADMIN).
- `GET /api/capacity?mes=YYYY-MM&id_tienda=X`: Matriz de capacity del mes.
- `GET /api/capacity/export.csv?mes=YYYY-MM&id_tienda=X`: Descarga la matriz para Excel.
- `GET /api/capacity/export?mes=YYYY-MM`: Formato largo heredado para Power Query.
- `POST /api/empleados` · `PUT /api/empleados/:id`: Crear y actualizar colaboradores.

> El capacity **no se escribe por API**: se deriva del horario oficial al aprobarse la semana.

### 👤 Usuarios (`/api/usuarios`) — ADMIN y SUPERVISOR
El Supervisor solo puede gestionar cuentas de Tienda/Oficina/Logística; eliminar es exclusivo de ADMIN.

- `GET /api/usuarios`: Lista de cuentas (nunca expone la contraseña).
- `POST /api/usuarios`: Crea una cuenta. La contraseña **se autogenera** y se devuelve una única vez. Según el caso recibe `email` (Admin/Supervisor), `tienda: {...}` (crea la tienda con su cuenta) o `empleado: {...}` (cuenta personal de Oficina/Logística).
- `PUT /api/usuarios/:id`: Cambia rol, sede o correo.
- `POST /api/usuarios/:id/reset-password` · `POST /api/usuarios/:id/toggle-activo`
- `DELETE /api/usuarios/:id`: Eliminación definitiva (solo ADMIN).
- `GET /api/usuarios/:id/historial` · `GET /api/auditoria`: Historial de cambios sobre cuentas.

### 📅 Horarios (`/api/horarios`)
- `GET /api/horarios/semana?semana_inicio=YYYY-MM-DD&id_tienda=X`: Semana con turnos, novedades y estado.
- `PUT /api/horarios/bulk-update`: Edición en vivo (bloqueada para TIENDA si la semana ya es oficial).
- `POST /api/horarios/solicitudes`: Crea o reemplaza la solicitud pendiente de esa semana.
- `PUT /api/horarios/solicitudes/:id`: La tienda corrige su solicitud mientras siga pendiente.
- `GET /api/horarios/solicitudes?estado=PENDIENTE`: Bandeja de solicitudes.
- `POST /api/horarios/solicitudes/:id/resolver`: Aprobar o rechazar (ADMIN/SUPERVISOR/RRHH). Se envía la `version` que se tenía cargada; si la tienda la corrigió mientras tanto, se rechaza la aprobación.
- `GET /api/horarios/export.xlsx?mes=YYYY-MM&id_tienda=X`: Mes completo, una hoja por semana (ADMIN/SUPERVISOR/RRHH).
- `GET /api/horarios/empleados/:id/novedades` · `POST /api/horarios/novedades` · `DELETE /api/horarios/novedades/:id`: Vacaciones, descanso médico, faltas, permisos y licencias.
- `PUT /api/horarios/empleados/:id/dia-descanso`: Día fijo de descanso.

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

Los cambios aplicados de esta forma quedan registrados acá para poder repetirlos
en otra base:

```sql
-- Fecha de ingreso: oculta al colaborador de los meses anteriores a su alta
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS fecha_ingreso DATE NULL;

-- El DNI pasa a ser único por tienda (una persona puede apoyar en otra sede)
ALTER TABLE empleados DROP CONSTRAINT IF EXISTS empleados_dni_key;
ALTER TABLE empleados ADD CONSTRAINT empleados_dni_tienda_key UNIQUE (dni, id_tienda);

-- Un código de vendedor no se repite dentro de la misma tienda
CREATE UNIQUE INDEX IF NOT EXISTS idx_empleado_codigo_por_tienda
  ON empleados(id_tienda, codigo_empleado) WHERE codigo_empleado IS NOT NULL;
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
| `empleados` | Una fila por colaborador **y sede**. `regimen` (FT/PT) define la dotación, `horas_semana` la jornada pactada, `situacion` incluye `NO_COMISIONA` y `fecha_ingreso` lo oculta de los periodos anteriores a su alta. El DNI es único por tienda: la misma persona puede tener ficha en varias sedes cuando va de apoyo, con un código de vendedor distinto en cada una. |
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

