-- Script de Migración PostgreSQL para bissú Capacity (Actualizado)

DROP TABLE IF EXISTS horario_solicitud_turnos CASCADE;
DROP TABLE IF EXISTS horario_solicitud_dias CASCADE;
DROP TABLE IF EXISTS horario_solicitudes CASCADE;
DROP TABLE IF EXISTS horario_semanas CASCADE;
DROP TABLE IF EXISTS horario_periodos CASCADE;
DROP TABLE IF EXISTS horario_turnos CASCADE;
DROP TABLE IF EXISTS horarios_diario CASCADE;
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
    rol VARCHAR(20) CHECK (rol IN ('TIENDA', 'SUPERVISOR', 'RRHH', 'ADMIN')) DEFAULT 'TIENDA',
    activo BOOLEAN NOT NULL DEFAULT TRUE
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
    fecha_baja DATE NULL, -- Fecha de retiro para filtrado de alta rotación en meses futuros
    dia_descanso VARCHAR(20) NULL -- Día fijo de descanso semanal (ej. 'MIERCOLES'), asignado manualmente
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

-- Módulo de Horarios: planificación separada de Capacity, con flujo de
-- envío/bloqueo y solicitud de permiso para reabrir un horario ya enviado.
-- El turno de un colaborador en un día puede tener varios bloques (turnos
-- partidos, ej. 09:00-13:00 y 15:00-18:00), por eso es una tabla de detalle
-- (varias filas por id_empleado+fecha) en vez de un único valor por día.

CREATE TABLE horario_turnos (
    id_turno SERIAL PRIMARY KEY,
    id_empleado INT NOT NULL REFERENCES empleados(id_empleado) ON DELETE CASCADE,
    fecha DATE NOT NULL,
    hora_inicio VARCHAR(5) NOT NULL, -- 'HH:MM'
    hora_fin VARCHAR(5) NOT NULL, -- 'HH:MM'
    usuario_modificacion INT REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_horario_turnos_empleado_fecha ON horario_turnos(id_empleado, fecha);

-- Estado de confirmación del horario por tienda y SEMANA (lunes de esa
-- semana). La sola presencia de confirmado_por indica que ya hay un horario
-- oficial para esa tienda+semana; su ausencia = todavía sin confirmar
-- (la tienda edita libremente en vivo).
CREATE TABLE horario_semanas (
    id_semana SERIAL PRIMARY KEY,
    id_tienda INT NOT NULL REFERENCES tiendas(id_tienda) ON DELETE CASCADE,
    semana_inicio DATE NOT NULL, -- Lunes de la semana
    confirmado_por INT NULL REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
    fecha_confirmacion TIMESTAMP NULL,
    CONSTRAINT unique_tienda_semana UNIQUE(id_tienda, semana_inicio)
);

-- Solicitud de cambio de horario para una tienda+semana, con los turnos
-- propuestos (no solo un motivo). Si la semana aún no tiene horario oficial,
-- el motivo se autogenera; si ya lo tiene, la tienda debe explicarlo. Al
-- aprobarse, sus turnos se aplican a horario_turnos y la semana queda
-- (re)confirmada. Solo puede haber una PENDIENTE a la vez por tienda+semana.
CREATE TABLE horario_solicitudes (
    id_solicitud SERIAL PRIMARY KEY,
    id_tienda INT NOT NULL REFERENCES tiendas(id_tienda) ON DELETE CASCADE,
    semana_inicio DATE NOT NULL,
    motivo TEXT NOT NULL,
    estado VARCHAR(20) NOT NULL CHECK (estado IN ('PENDIENTE', 'APROBADA', 'RECHAZADA')) DEFAULT 'PENDIENTE',
    solicitado_por INT REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
    fecha_solicitud TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resuelto_por INT NULL REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
    fecha_resolucion TIMESTAMP NULL,
    comentario_resolucion TEXT NULL
);

-- Días (empleado+fecha) que la solicitud modifica respecto al horario
-- oficial. Su ausencia aquí = sin cambios ese día; 0 filas en
-- horario_solicitud_turnos para ese día = se propone dejarlo sin turnos.
CREATE TABLE horario_solicitud_dias (
    id_solicitud INT NOT NULL REFERENCES horario_solicitudes(id_solicitud) ON DELETE CASCADE,
    id_empleado INT NOT NULL REFERENCES empleados(id_empleado) ON DELETE CASCADE,
    fecha DATE NOT NULL,
    PRIMARY KEY (id_solicitud, id_empleado, fecha)
);

CREATE TABLE horario_solicitud_turnos (
    id_solicitud INT NOT NULL REFERENCES horario_solicitudes(id_solicitud) ON DELETE CASCADE,
    id_empleado INT NOT NULL REFERENCES empleados(id_empleado) ON DELETE CASCADE,
    fecha DATE NOT NULL,
    hora_inicio VARCHAR(5) NOT NULL,
    hora_fin VARCHAR(5) NOT NULL
);
CREATE INDEX idx_horario_solicitud_turnos ON horario_solicitud_turnos(id_solicitud, id_empleado, fecha);
