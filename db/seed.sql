-- Seed Data para bissú Capacity (Agosto 2026)

-- 1. Tiendas con Rangos de 10 Plazas
INSERT INTO tiendas (codigo_almacen, nombre_tienda, rango_codigos, correo_tienda, encargada, correo_encargada) VALUES
('ALMA31', 'JESUS MARIA', '0100-0109', 'bissujesusmaria@bissu.pe', 'María Elena Torres', 'mtorres@bissu.pe'),
('ALMA32', 'SAN ISIDRO', '0110-0119', 'bissusanisidro@bissu.pe', 'Carla Mendoza', 'cmendoza@bissu.pe'),
('ALMA33', 'MIRAFLORES', '0120-0129', 'bissumiraflores@bissu.pe', 'Lucía Fernández', 'lfernandez@bissu.pe');

-- 2. Usuarios (Password por defecto para todos en demo: '123456')
-- Hash bcrypt válido de '123456': $2a$10$GzxIYmSVChGuqS8j.kgy3OHRJBkCpNnjON0ZTn7ROp3s86D5tM7OK
INSERT INTO usuarios (email, password_hash, id_tienda, rol) VALUES
('bissujesusmaria@bissu.pe', '$2a$10$GzxIYmSVChGuqS8j.kgy3OHRJBkCpNnjON0ZTn7ROp3s86D5tM7OK', 1, 'TIENDA'),
('bissusanisidro@bissu.pe', '$2a$10$GzxIYmSVChGuqS8j.kgy3OHRJBkCpNnjON0ZTn7ROp3s86D5tM7OK', 2, 'TIENDA'),
('admin@bissu.pe', '$2a$10$GzxIYmSVChGuqS8j.kgy3OHRJBkCpNnjON0ZTn7ROp3s86D5tM7OK', NULL, 'ADMIN'),
('supervisor@bissu.pe', '$2a$10$GzxIYmSVChGuqS8j.kgy3OHRJBkCpNnjON0ZTn7ROp3s86D5tM7OK', NULL, 'SUPERVISOR'),
('rrhh@bissu.pe', '$2a$10$GzxIYmSVChGuqS8j.kgy3OHRJBkCpNnjON0ZTn7ROp3s86D5tM7OK', NULL, 'RRHH');

-- 3. Empleados de Tienda JESUS MARIA (id_tienda = 1, Rango: 0100 - 0109)
INSERT INTO empleados (dni, codigo_empleado, nombre_completo, puesto, regimen, celular, correo_asesor, id_tienda, situacion, fecha_baja) VALUES
('71234567', '0100', 'María Elena Torres', 'ENCARGADA DE TIENDA', 'FT', '987654321', 'mtorres.0100@bissu.pe', 1, 'ACTIVO', NULL),
('72345678', '0101', 'Ana Paula Gómez', 'ASESOR DE VENTAS', 'FT', '987654322', 'agomez.0101@bissu.pe', 1, 'ACTIVO', NULL),
('73456789', '0102', 'Sofía Salazar', 'ASESOR DE VENTAS', 'PT', '987654323', 'ssalazar.0102@bissu.pe', 1, 'ACTIVO', NULL),
('74567890', NULL, 'Camila Benítez', 'ASESOR DE VENTAS (EN PRUEBA)', 'FT', '987654324', NULL, 1, 'ACTIVO', NULL),
('75678901', '0103', 'Valeria Rojas', 'CAJERA', 'PT', '987654325', 'vrojas.0103@bissu.pe', 1, 'ACTIVO', NULL),
('78901234', '0104', 'Luciana Vega', 'ASESOR DE VENTAS', 'FT', '987654326', 'lvega.0104@bissu.pe', 1, 'INACTIVO', '2026-08-15');

-- Empleados de Tienda SAN ISIDRO (id_tienda = 2, Rango: 0110 - 0119)
INSERT INTO empleados (dni, codigo_empleado, nombre_completo, puesto, regimen, celular, correo_asesor, id_tienda, situacion, fecha_baja) VALUES
('76789012', '0110', 'Carla Mendoza', 'ENCARGADA DE TIENDA', 'FT', '987654327', 'cmendoza.0110@bissu.pe', 2, 'ACTIVO', NULL),
('77890123', '0111', 'Patricia Rivas', 'ASESOR DE VENTAS', 'FT', '987654328', 'privas.0111@bissu.pe', 2, 'ACTIVO', NULL);

-- 4. Capacity diario inicial para Agosto 2026
INSERT INTO capacity_diario (id_empleado, fecha, valor, usuario_modificacion) VALUES
(1, '2026-08-01', 1.0, 1), (1, '2026-08-02', 1.0, 1), (1, '2026-08-03', 1.0, 1), (1, '2026-08-04', 1.0, 1), (1, '2026-08-05', 0.5, 1),
(2, '2026-08-01', 1.0, 1), (2, '2026-08-02', 1.0, 1), (2, '2026-08-03', 0.0, 1), (2, '2026-08-04', 1.0, 1), (2, '2026-08-05', 1.0, 1),
(3, '2026-08-01', 0.5, 1), (3, '2026-08-02', 0.5, 1), (3, '2026-08-03', 0.5, 1), (3, '2026-08-04', 0.0, 1), (3, '2026-08-05', 1.0, 1), -- PT haciendo 1.0 turno completo
(4, '2026-08-01', 1.0, 1), (4, '2026-08-02', 1.0, 1), (4, '2026-08-03', 1.0, 1), (4, '2026-08-04', 1.0, 1), (4, '2026-08-05', 1.0, 1),
(5, '2026-08-01', 1.0, 1), (5, '2026-08-02', 0.0, 1), (5, '2026-08-03', 1.0, 1), (5, '2026-08-04', 1.0, 1), (5, '2026-08-05', 0.5, 1),
(6, '2026-08-01', 1.0, 1), (6, '2026-08-02', 1.0, 1), (6, '2026-08-03', 1.0, 1), (6, '2026-08-15', 0.0, 1);
