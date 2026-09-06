-- Script de Migración PostgreSQL para bissú Capacity (Actualizado)

DROP TABLE IF EXISTS capacity_diario CASCADE;
DROP TABLE IF EXISTS empleados CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;
DROP TABLE IF EXISTS tiendas CASCADE;

CREATE TABLE tiendas (
    id_tienda SERIAL PRIMARY KEY,
    codigo_almacen VARCHAR(20),
    nombre_tienda VARCHAR(100) NOT NULL,
    rango_codigos VARCHAR(50), -- Ej. '0100-0109' para 10 plazas
    correo_tienda VARCHAR(150) UNIQUE NOT NULL,
    encargada VARCHAR(150),
    correo_encargada VARCHAR(150)
);

CREATE TABLE usuarios (
    id_usuario SERIAL PRIMARY KEY,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    id_tienda INT NULL REFERENCES tiendas(id_tienda) ON DELETE SET NULL,
    rol VARCHAR(20) CHECK (rol IN ('TIENDA', 'SUPERVISOR', 'RRHH', 'ADMIN')) DEFAULT 'TIENDA'
);

CREATE TABLE empleados (
    id_empleado SERIAL PRIMARY KEY,
    dni VARCHAR(15) UNIQUE NOT NULL,
    codigo_empleado VARCHAR(20) NULL, -- Código de asesor (ej. '0101'). Opcional durante días de prueba
    nombre_completo VARCHAR(150) NOT NULL,
    puesto VARCHAR(100), -- ej. 'ENCARGADA DE TIENDA', 'ASESOR DE VENTAS', 'CAJERA'
    regimen VARCHAR(10), -- 'FT' o 'PT'
    celular VARCHAR(20) NULL, -- Celular para envío de contraseña/credenciales
    correo_asesor VARCHAR(150) NULL, -- Correo corporativo de asesor
    id_tienda INT NOT NULL REFERENCES tiendas(id_tienda) ON DELETE CASCADE,
    situacion VARCHAR(20) DEFAULT 'ACTIVO', -- 'ACTIVO', 'INACTIVO'
    fecha_baja DATE NULL -- Fecha de retiro para filtrado de alta rotación en meses futuros
);

CREATE TABLE capacity_diario (
    id_registro SERIAL PRIMARY KEY,
    id_empleado INT NOT NULL REFERENCES empleados(id_empleado) ON DELETE CASCADE,
    fecha DATE NOT NULL,
    valor NUMERIC(3,2) NOT NULL DEFAULT 0.0,
    usuario_modificacion INT REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_empleado_fecha UNIQUE(id_empleado, fecha)
);
