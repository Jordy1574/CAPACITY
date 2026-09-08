import openpyxl
import sqlite3
import os
import re
import datetime
from collections import Counter

DB_PATH = os.path.join(os.path.dirname(__file__), 'capacity.db')

# Email mapping for stores
STORE_EMAILS = {
    'CAJAMARCA': 'bissucajamarca@bissu.pe',
    'CHICLAYO': 'bissuchiclayo@bissu.pe',
    'CHIMBOTE': 'bissuchimbote@bissu.pe',
    'CUSCO': 'bissucusco@bissu.pe',
    'ICA': 'bissuica@bissu.pe',
    'ICA2': 'bissuica2@bissu.pe',
    'IQUITOS': 'bissuiquitos@bissu.pe',
    'JESUS MARIA': 'bissujesusmaria@bissu.pe',
    'JULIACA': 'bissujuliaca@bissu.pe',
    'LARCO': 'bissularco@bissu.pe',
    'MAGDALENA': 'bissumagdalena@bissu.pe',
    'MALLPLAZA AQP': 'bissumallplazaaqp@bissu.pe',
    'MERCADERES': 'bissumercaderes@bissu.pe',
    'PLAZA TACNA': 'bissutacna2@bissu.pe',
    'PORONGOCHE': 'bissuporongoche@bissu.pe',
    'PURUCHUCO': 'bissupuruchuco@bissu.pe',
    'ROYAL PLAZA': 'bissuroyalplaza@bissu.pe',
    'SAN JUAN L.': 'bissusjl@bissu.pe',
    'STO DOMINGO': 'bissusantodomingo@bissu.pe',
    'TACNA': 'bissutacna@bissu.pe',
    'TACNA 3': 'bissutacna3@bissu.pe'
}

def clean_str(val):
    if val is None:
        return None
    s = str(val).strip()
    return s if s != '' else None

def clean_dni(val):
    if val is None:
        return None
    s = re.sub(r'\D', '', str(val))
    if len(s) > 0:
        return s.zfill(8)
    return None

def clean_code(val):
    if val is None:
        return None
    s = str(val).strip()
    if s.endswith('.0'):
        s = s[:-2]
    if s.isdigit():
        return s.zfill(4)
    return s if s != '' else None

def compute_rango_codigos(codes):
    """Cada tienda tiene un bloque de 10 plazas que empieza en un múltiplo de 10
    (ej. 0160-0169, 0300-0309). Se elige la década con más códigos asignados
    para descartar códigos atípicos (ej. '7777', '8887', '0000') que no
    pertenecen a la numeración secuencial real de la tienda."""
    if not codes:
        return "0100-0109"
    decades = Counter((int(c) // 10) * 10 for c in codes)
    best_decade = max(sorted(decades), key=lambda d: decades[d])
    return f"{best_decade:04d}-{best_decade + 9:04d}"

def parse_excel_data():
    base_dir = os.path.dirname(os.path.dirname(__file__))
    agosto_path = os.path.join(base_dir, '8. Capacity Agosto 2026.xlsx')
    sept_path = os.path.join(base_dir, '9. Capacity Septiembre 2026.xlsx')

    # 1. Parse Agosto Excel (Roster info: Celular, Correo Asesor, Supervisor)
    agosto_info = {} # key: dni or name -> {celular, correo_asesor, supervisor}
    if os.path.exists(agosto_path):
        wb_aug = openpyxl.load_workbook(agosto_path, data_only=True)
        sheet_aug = wb_aug['CAPACITY']
        for r in range(2, sheet_aug.max_row + 1):
            sup = clean_str(sheet_aug.cell(r, 1).value)
            tienda = clean_str(sheet_aug.cell(r, 2).value)
            dni = clean_dni(sheet_aug.cell(r, 3).value)
            celular = clean_str(sheet_aug.cell(r, 4).value)
            codigo = clean_code(sheet_aug.cell(r, 5).value)
            puesto = clean_str(sheet_aug.cell(r, 6).value)
            nombre = clean_str(sheet_aug.cell(r, 7).value)
            user_prefix = clean_str(sheet_aug.cell(r, 8).value)
            domain = clean_str(sheet_aug.cell(r, 9).value)

            correo = None
            if user_prefix and domain:
                correo = f"{user_prefix}{domain}".lower()
            elif user_prefix and '@' in user_prefix:
                correo = user_prefix.lower()

            item = {
                'supervisor': sup,
                'celular': celular,
                'correo_asesor': correo
            }
            if dni:
                agosto_info[dni] = item
            if nombre:
                agosto_info[nombre.upper()] = item

    # 2. Parse Septiembre Excel (Complete structure + attendance)
    stores = {} # name -> {almacen, email, codigos: [], emps: []}
    employees = []
    attendance = [] # (id_emp_key, date_str, value)

    if os.path.exists(sept_path):
        wb_sep = openpyxl.load_workbook(sept_path, data_only=True)
        sheet_sep = wb_sep['CAPACITY']

        # Extract date headers from cols 13 to 42
        date_cols = {}
        for c in range(13, 43):
            val = sheet_sep.cell(1, c).value
            if isinstance(val, datetime.datetime):
                date_cols[c] = val.strftime('%Y-%m-%d')
            elif isinstance(val, datetime.date):
                date_cols[c] = val.strftime('%Y-%m-%d')
            elif val:
                s_val = str(val).strip()
                if '2026-09' in s_val:
                    date_cols[c] = s_val[:10]

        for r in range(2, sheet_sep.max_row + 1):
            almacen = clean_str(sheet_sep.cell(r, 1).value)
            sup = clean_str(sheet_sep.cell(r, 2).value)
            tienda = clean_str(sheet_sep.cell(r, 3).value)
            dni = clean_dni(sheet_sep.cell(r, 4).value)
            codigo = clean_code(sheet_sep.cell(r, 5).value)
            puesto = clean_str(sheet_sep.cell(r, 6).value)
            nombre = clean_str(sheet_sep.cell(r, 7).value)
            regimen = clean_str(sheet_sep.cell(r, 8).value) or 'FT'
            fecha_ing = sheet_sep.cell(r, 9).value
            fecha_cese = sheet_sep.cell(r, 10).value
            situacion = clean_str(sheet_sep.cell(r, 11).value) or 'ACTIVO'

            if not nombre and not dni:
                continue

            t_name = tienda.upper() if tienda else 'UNKNOWN'
            if t_name not in stores:
                stores[t_name] = {
                    'almacen': almacen or 'ALMA00',
                    'email': STORE_EMAILS.get(t_name, f"bissu{t_name.lower().replace(' ', '')}@bissu.pe"),
                    'codigos': []
                }
            if codigo:
                stores[t_name]['codigos'].append(codigo)

            # Match Agosto extra info
            extra = agosto_info.get(dni) or agosto_info.get(nombre.upper() if nombre else '') or {}
            celular = extra.get('celular')
            correo = extra.get('correo_asesor')

            fecha_baja_str = None
            if isinstance(fecha_cese, (datetime.datetime, datetime.date)):
                fecha_baja_str = fecha_cese.strftime('%Y-%m-%d')

            emp_key = len(employees) + 1
            final_dni = dni or f"DNI{emp_key:04d}"

            emp_obj = {
                'key': emp_key,
                'dni': final_dni,
                'codigo_empleado': codigo,
                'nombre_completo': nombre,
                'puesto': puesto or 'ASESOR DE VENTAS',
                'regimen': regimen,
                'celular': celular,
                'correo_asesor': correo,
                'tienda_name': t_name,
                'situacion': situacion,
                'fecha_baja': fecha_baja_str
            }
            employees.append(emp_obj)

            # Extract attendance for Sept 2026
            for col_idx, date_str in date_cols.items():
                cell_val = sheet_sep.cell(r, col_idx).value
                if cell_val is not None and cell_val != '':
                    try:
                        num_val = float(cell_val)
                        attendance.append((emp_key, date_str, num_val))
                    except ValueError:
                        pass

    return stores, employees, attendance

def import_to_db():
    stores, employees, attendance = parse_excel_data()

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    # Re-create schema
    cur.executescript("""
        DROP TABLE IF EXISTS capacity_diario;
        DROP TABLE IF EXISTS empleados;
        DROP TABLE IF EXISTS usuarios;
        DROP TABLE IF EXISTS tiendas;

        CREATE TABLE tiendas (
            id_tienda INTEGER PRIMARY KEY AUTOINCREMENT,
            codigo_almacen TEXT,
            nombre_tienda TEXT NOT NULL,
            rango_codigos TEXT,
            correo_tienda TEXT UNIQUE NOT NULL,
            encargada TEXT,
            correo_encargada TEXT
        );

        CREATE TABLE usuarios (
            id_usuario INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            id_tienda INTEGER NULL,
            rol TEXT CHECK (rol IN ('TIENDA', 'SUPERVISOR', 'RRHH', 'ADMIN')) DEFAULT 'TIENDA',
            FOREIGN KEY (id_tienda) REFERENCES tiendas(id_tienda) ON DELETE SET NULL
        );

        CREATE TABLE empleados (
            id_empleado INTEGER PRIMARY KEY AUTOINCREMENT,
            dni TEXT UNIQUE NOT NULL,
            codigo_empleado TEXT,
            nombre_completo TEXT NOT NULL,
            puesto TEXT,
            regimen TEXT,
            celular TEXT,
            correo_asesor TEXT,
            id_tienda INTEGER NOT NULL,
            situacion TEXT DEFAULT 'ACTIVO',
            fecha_baja TEXT,
            FOREIGN KEY (id_tienda) REFERENCES tiendas(id_tienda) ON DELETE CASCADE
        );

        CREATE TABLE capacity_diario (
            id_registro INTEGER PRIMARY KEY AUTOINCREMENT,
            id_empleado INTEGER NOT NULL,
            fecha TEXT NOT NULL,
            valor REAL NOT NULL DEFAULT 0.0,
            usuario_modificacion INTEGER,
            fecha_actualizacion DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(id_empleado, fecha),
            FOREIGN KEY (id_empleado) REFERENCES empleados(id_empleado) ON DELETE CASCADE,
            FOREIGN KEY (usuario_modificacion) REFERENCES usuarios(id_usuario) ON DELETE SET NULL
        );
    """)

    # Default password hash for '123456'
    default_hash = '$2a$10$GzxIYmSVChGuqS8j.kgy3OHRJBkCpNnjON0ZTn7ROp3s86D5tM7OK'

    # Insert Stores and Store Users
    store_id_map = {}
    for t_name, s_info in stores.items():
        cods = sorted([c for c in s_info['codigos'] if c.isdigit()])
        rango = compute_rango_codigos(cods)

        cur.execute("""
            INSERT INTO tiendas (codigo_almacen, nombre_tienda, rango_codigos, correo_tienda, encargada, correo_encargada)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (s_info['almacen'], t_name, rango, s_info['email'], None, None))
        
        id_tienda = cur.lastrowid
        store_id_map[t_name] = id_tienda

        # Insert Store User
        cur.execute("""
            INSERT INTO usuarios (email, password_hash, id_tienda, rol)
            VALUES (?, ?, ?, 'TIENDA')
        """, (s_info['email'], default_hash, id_tienda))

    # Insert Admin/Supervisor/RRHH Users
    cur.execute("INSERT INTO usuarios (email, password_hash, id_tienda, rol) VALUES (?, ?, NULL, 'ADMIN')", ('admin@bissu.pe', default_hash))
    cur.execute("INSERT INTO usuarios (email, password_hash, id_tienda, rol) VALUES (?, ?, NULL, 'SUPERVISOR')", ('supervisor@bissu.pe', default_hash))
    cur.execute("INSERT INTO usuarios (email, password_hash, id_tienda, rol) VALUES (?, ?, NULL, 'RRHH')", ('rrhh@bissu.pe', default_hash))

    # Insert Employees
    seen_dnis = set()
    emp_id_map = {} # emp_key -> db_id_empleado
    for emp in employees:
        id_tienda = store_id_map.get(emp['tienda_name'], 1)
        raw_dni = emp['dni']
        dni_val = raw_dni
        counter = 1
        while dni_val in seen_dnis:
            counter += 1
            dni_val = f"{raw_dni}_{counter}"
        seen_dnis.add(dni_val)

        cur.execute("""
            INSERT INTO empleados (dni, codigo_empleado, nombre_completo, puesto, regimen, celular, correo_asesor, id_tienda, situacion, fecha_baja)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (dni_val, emp['codigo_empleado'], emp['nombre_completo'], emp['puesto'], emp['regimen'], emp['celular'], emp['correo_asesor'], id_tienda, emp['situacion'], emp['fecha_baja']))
        
        emp_id_map[emp['key']] = cur.lastrowid

    # Insert Attendance for September 2026
    att_inserted = 0
    for key, date_str, val in attendance:
        db_emp_id = emp_id_map.get(key)
        if db_emp_id:
            cur.execute("""
                INSERT OR REPLACE INTO capacity_diario (id_empleado, fecha, valor, usuario_modificacion)
                VALUES (?, ?, ?, 1)
            """, (db_emp_id, date_str, val))
            att_inserted += 1

    # Also seed initial Agosto 2026 attendance (2026-08-01 to 2026-08-31) for active employees
    agosto_dates = [f"2026-08-{d:02d}" for d in range(1, 32)]
    agosto_att_inserted = 0
    for emp in employees:
        db_emp_id = emp_id_map.get(emp['key'])
        if not db_emp_id:
            continue
        assigned_val = 0.5 if emp['regimen'] == 'PT' else 1.0
        for date_str in agosto_dates:
            if emp['situacion'] == 'INACTIVO' and emp['fecha_baja'] and date_str > emp['fecha_baja']:
                continue
            cur.execute("""
                INSERT OR REPLACE INTO capacity_diario (id_empleado, fecha, valor, usuario_modificacion)
                VALUES (?, ?, ?, 1)
            """, (db_emp_id, date_str, assigned_val))
            agosto_att_inserted += 1

    conn.commit()
    conn.close()

    print("=== IMPORT COMPLETED SUCCESSFULLY ===")
    print(f"Tiendas creadas: {len(stores)}")
    print(f"Usuarios creados: {len(stores) + 3}")
    print(f"Empleados creados: {len(employees)}")
    print(f"Registros de asistencia Septiembre 2026: {att_inserted}")
    print(f"Registros de asistencia Agosto 2026: {agosto_att_inserted}")

if __name__ == '__main__':
    import_to_db()
