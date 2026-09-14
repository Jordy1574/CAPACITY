-- Script de Migración PostgreSQL para bissú Capacity (Actualizado)

DROP TABLE IF EXISTS empleado_novedades CASCADE;
DROP TABLE IF EXISTS usuarios_auditoria CASCADE;
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
    rango_codigos VARCHAR(50), -- Ej. '0100-0109' para 10 plazas (solo aplica a tipo TIENDA)
    correo_tienda VARCHAR(150) UNIQUE, -- Sin correo para sedes de OFICINA/LOGISTICA (login es individual por empleado)
    encargada VARCHAR(150),
    correo_encargada VARCHAR(150),
    tipo VARCHAR(20) NOT NULL DEFAULT 'TIENDA' CHECK (tipo IN ('TIENDA', 'OFICINA', 'LOGISTICA'))
);

CREATE TABLE usuarios (
    id_usuario SERIAL PRIMARY KEY,
    email VARCHAR(150) UNIQUE, -- NULL para cuentas TIENDA/OFICINA/LOGISTICA (usan username)
    username VARCHAR(100) UNIQUE, -- NULL para cuentas ADMIN/SUPERVISOR (usan email)
    password_hash VARCHAR(255) NOT NULL,
    id_tienda INT NULL REFERENCES tiendas(id_tienda) ON DELETE SET NULL,
    -- Cuenta personal de un empleado (Oficina/Logística): solo registra su
    -- propio horario. NULL = cuenta compartida de la sede, que en una tienda
    -- usa la encargada para llenar el horario de todo su equipo.
    -- (La FK se agrega más abajo, una vez creada la tabla empleados.)
    id_empleado INT NULL,
    rol VARCHAR(20) CHECK (rol IN ('TIENDA', 'SUPERVISOR', 'RRHH', 'ADMIN')) DEFAULT 'TIENDA',
    activo BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE UNIQUE INDEX idx_usuarios_empleado_unico ON usuarios(id_empleado) WHERE id_empleado IS NOT NULL;

-- Auditoría de cambios administrativos sobre cuentas (creación, edición de
-- rol/correo, reseteo de contraseña, activar/desactivar, eliminación).
-- id_usuario_afectado/actor son SET NULL al borrar la cuenta para no perder
-- el historial; por eso se guarda también un snapshot en texto del
-- identificador (email o username) de cada uno al momento de la acción.
CREATE TABLE usuarios_auditoria (
    id_auditoria SERIAL PRIMARY KEY,
    id_usuario_afectado INT NULL REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
    identificador_afectado VARCHAR(150) NOT NULL,
    accion VARCHAR(30) NOT NULL CHECK (accion IN ('CREAR', 'EDITAR_ROL', 'EDITAR_CORREO', 'EDITAR_SEDE', 'RESET_PASSWORD', 'ACTIVAR', 'DESACTIVAR', 'ELIMINAR')),
    detalle TEXT NULL,
    id_usuario_actor INT NULL REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
    actor_identificador VARCHAR(150) NOT NULL,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_usuarios_auditoria_afectado ON usuarios_auditoria(id_usuario_afectado);
CREATE INDEX idx_usuarios_auditoria_fecha ON usuarios_auditoria(fecha DESC);

-- Una fila = una persona EN UNA SEDE. La misma persona puede tener ficha en
-- varias tiendas cuando va de apoyo, con un código de vendedor distinto en
-- cada una; por eso el DNI es único por tienda y no a nivel global.
CREATE TABLE empleados (
    id_empleado SERIAL PRIMARY KEY,
    dni VARCHAR(15) NOT NULL,
    codigo_empleado VARCHAR(20) NULL, -- Código de asesor (ej. '0101'). Opcional durante días de prueba
    nombre_completo VARCHAR(150) NOT NULL, -- Siempre en MAYÚSCULAS
    puesto VARCHAR(100), -- ej. 'ENCARGADA DE TIENDA', 'ASESOR DE VENTAS', 'CAJERA'
    regimen VARCHAR(10), -- 'FT' o 'PT'
    celular VARCHAR(20) NULL, -- Celular para envío de contraseña/credenciales
    correo_asesor VARCHAR(150) NULL, -- Correo corporativo de asesor
    id_tienda INT NOT NULL REFERENCES tiendas(id_tienda) ON DELETE CASCADE,
    situacion VARCHAR(20) DEFAULT 'ACTIVO', -- 'ACTIVO', 'INACTIVO', 'NO_COMISIONA'
    fecha_ingreso DATE NULL, -- No aparece en capacity/horarios de periodos anteriores. NULL = personal histórico
    fecha_baja DATE NULL, -- Fecha de retiro para filtrado de alta rotación en meses futuros
    dia_descanso VARCHAR(20) NULL, -- Día fijo de descanso semanal (ej. 'MIERCOLES'), asignado manualmente
    horas_semana NUMERIC(5,2) NULL, -- Jornada pactada. NULL = estándar del régimen (FT 48, PT 23.5)
    CONSTRAINT empleados_dni_tienda_key UNIQUE (dni, id_tienda)
);

-- Dentro de una sede el código de vendedor identifica una plaza: no puede
-- repetirse. Entre sedes se evita con rangos que no se cruzan (tiendas.rango_codigos).
CREATE UNIQUE INDEX idx_empleado_codigo_por_tienda
    ON empleados(id_tienda, codigo_empleado) WHERE codigo_empleado IS NOT NULL;

-- Ausencias y licencias. Un registro por rango cubre vacaciones, descanso
-- médico, faltas, permisos y licencias: en el horario el día deja de verse
-- como un hueco ambiguo y pasa a tener motivo.
CREATE TABLE empleado_novedades (
    id_novedad SERIAL PRIMARY KEY,
    id_empleado INT NOT NULL REFERENCES empleados(id_empleado) ON DELETE CASCADE,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('VACACIONES', 'DESCANSO_MEDICO', 'FALTA', 'PERMISO', 'LICENCIA')),
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    con_goce BOOLEAN NOT NULL DEFAULT TRUE,
    observacion TEXT NULL,
    registrado_por INT NULL REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT rango_valido CHECK (fecha_fin >= fecha_inicio)
);
CREATE INDEX idx_novedades_empleado_fecha ON empleado_novedades(id_empleado, fecha_inicio, fecha_fin);

ALTER TABLE usuarios
    ADD CONSTRAINT fk_usuarios_empleado FOREIGN KEY (id_empleado) REFERENCES empleados(id_empleado) ON DELETE CASCADE;

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
