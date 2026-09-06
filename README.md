# bissú Capacity - Sistema de Gestión de Asistencia y Capacidad

Aplicación web ultra ligera, rápida y optimizada para la gestión de capacidad y asistencia por tienda de **bissú ACCESORIOS**.

---

## 🚀 Características Principales

1. **Aislamiento por Tienda (Row-Level Security - RLS)**:
   - Cada tienda (`TIENDA`) solo puede visualizar y editar la matriz de capacidad de sus propios empleados.
   - El backend valida estrictamente que ninguna tienda pueda alterar registros de otra sede.
   - Roles de administración (`ADMIN`, `SUPERVISOR`, `RRHH`) tienen vista consolidada y selector de tiendas.
2. **Interfaz Antigravity & Identidad Bissú**:
   - Tarjetas métricas flotantes con sombras suaves y estética moderna.
   - Tabla interactiva estilo hoja de cálculo con celdas elevables al pasar el cursor (hover).
   - Edición ultra rápida por clic (valores `1.0`, `0.5`, `0.0`) y notificaciones emergentes (Toast notifications).
3. **Exportación Directa a Power Query / Power BI**:
   - Endpoint `/api/capacity/export` protegido por API Key.
   - Devuelve la matriz desdinamizada (*unpivoted*) lista para consumir directamente en Power Query sin transformaciones manuales.
4. **Soporte Dual de Base de Datos**:
   - Soporta **PostgreSQL** mediante `pg`.
   - Incluye respaldo automático en **SQLite** local si no se configura `DATABASE_URL`, permitiendo correr la app al instante sin instalar bases de datos externas.

---

## 🛠️ Requisitos Previos

- **Node.js**: v18 o superior.
- **PostgreSQL** *(opcional)*: v14 o superior (si no está disponible, el sistema usará SQLite automáticamente).

---

## 💻 Inicio Rápido Local

1. **Instalar dependencias**:
   ```bash
   npm install
   ```

2. **Iniciar la aplicación**:
   ```bash
   npm start
   ```

3. **Acceder desde el navegador**:
   - App Principal: `http://localhost:3000`
   - Pantalla de Login: `http://localhost:3000/login`

---

## 🔑 Credenciales de Demostración

| Rol | Correo Electrónico | Contraseña | Alcance / Permisos |
| :--- | :--- | :--- | :--- |
| **Tienda (Jesús María)** | `bissujesusmaria@bissu.pe` | `123456` | Solo ve y edita la tienda Jesús María. |
| **Tienda (San Isidro)** | `bissusanisidro@bissu.pe` | `123456` | Solo ve y edita la tienda San Isidro. |
| **Administrador** | `admin@bissu.pe` | `123456` | Acceso global a todas las tiendas y exportación. |
| **Supervisor** | `supervisor@bissu.pe` | `123456` | Acceso global y supervisión por tienda. |

---

## 🗄️ Configuración de PostgreSQL (Opcional)

Si deseas utilizar una base de datos PostgreSQL en producción o servidor local:

1. Crea la base de datos en PostgreSQL:
   ```sql
   CREATE DATABASE bissu_capacity;
   ```
2. Ejecuta los scripts SQL provistos en el directorio `db/`:
   ```bash
   psql -U postgres -d bissu_capacity -f db/schema.sql
   psql -U postgres -d bissu_capacity -f db/seed.sql
   ```
3. Crea un archivo `.env` tomando como base `.env.example`:
   ```env
   PORT=3000
   HOST=0.0.0.0
   JWT_SECRET=bissu_capacity_secret_key_2026_super_secure
   API_KEY_EXPORT=bissu_power_query_key_98765
   DATABASE_URL=postgresql://postgres:tu_password@localhost:5432/bissu_capacity
   ```

---

## 📊 Integración con Power Query / Power BI

Para conectar Power BI o Excel directamente a los datos de capacity sin transformaciones manuales:

1. En la aplicación web, inicia sesión como Administrador o haz clic en el botón **Power Query BI** en la barra superior.
2. Copia la URL de exportación:
   ```text
   http://localhost:3000/api/capacity/export?mes=2026-08&api_key=bissu_power_query_key_98765
   ```
3. En **Power BI Desktop** o **Excel**:
   - Ve a `Obtener Datos` -> `Desde la Web`.
   - Pega la URL y presiona `Aceptar`.
4. Los datos se cargarán en formato desdinamizado con las siguientes columnas:
   - `fecha`, `dni`, `codigo_empleado`, `nombre_empleado`, `puesto`, `regimen`, `codigo_almacen`, `nombre_tienda`, `valor`.

---

## 📁 Estructura del Proyecto

```text
├── package.json
├── .env.example
├── db/
│   ├── schema.sql
│   └── seed.sql
├── src/
│   ├── app.js
│   ├── config/
│   │   └── db.js
│   ├── middleware/
│   │   └── auth.js
│   ├── routes/
│   │   ├── auth.js
│   │   └── capacity.js
│   └── public/
│       ├── index.html
│       ├── login.html
│       ├── css/
│       │   └── custom.css
│       └── js/
│           └── app.js
└── README.md
```
