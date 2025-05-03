import sqlite3
import argparse
import time
from pathlib import Path
import re
import struct

import serial  # type: ignore

def read_db(db_name, table_name):
    connection = sqlite3.connect(db_name)
    cursor = connection.cursor()
    cursor.execute("SELECT * FROM "+table_name)
    results = cursor.fetchall()
    print(results)
    string=""
    linea = ""
    stritem = ""
    array = []

    for flight in results:
        i=0
        linea = ""
        for item in flight:

            if i == 1:
                if item <= 999 and item >= 99:
                    stritem = "0" + str(item)
                elif item<=99 and item>=9:
                    stritem = "00" + str(item)
                elif item <= 9:
                    stritem = "000" + str(item)
                else:
                    stritem = str(item) 

            elif i == 3:
                if item<=99 and item>=9:
                    stritem = "0" + str(item)
                elif item <= 9:
                    stritem = "00" + str(item)
                else:
                    stritem = str(item)

            else:
                stritem = str(item)
            string += stritem
            linea += stritem

            i += 1
        array.append(linea)
        string += "\n"
    with open("flights.txt","w") as txt:
        txt.write(string)
    with open("flights-history.txt","a+") as txt:
        txt.write(string+"\- - - - - - - - - \ \n")
    return array

# ------------------ Configuración ------------------------------------------ #
DEFAULT_BAUD = 115_200
PAUSE_BETWEEN_LINES = 0.01   # s entre registros

# ------------------ Expresión regular -------------------------------------- #
PATTERN = re.compile(
    r"^"
    r"(?P<city>[A-Z]{3})"     # 3 letras
    r"(?P<num1>\d{1,4})"     # 1‑4 dígitos (0‑9999)
    r"(?P<letter>[A-Z])"      # 1 letra
    r"(?P<num2>\d{1,3})"     # 1‑3 dígitos (0‑255)
    r"(?P<char2>[A-Z0-9])"    # 1 letra o dígito
    r"(?P<time>\d{1,10})"    # 1‑10 dígitos (0‑4 294 967 295)
    r"$"
)

# ------------------ Utilidades -------------------------------------------- #

def _compact(line: str) -> str:
    """Devuelve la línea sin espacios y en mayúsculas."""
    return re.sub(r"\s+", "", line.strip()).upper()


def char_to_hex_value(c: str) -> int:
    """A‑Z → 0xA‑0x1A, 0‑9 → 0x0‑0x9."""
    if c.isdigit():
        return int(c)
    if c.isupper():
        return 0xA + (ord(c) - ord("A"))
    raise ValueError(f"Carácter no válido: {c!r}")

# ------------------ Empaquetado ------------------------------------------- #

STRUCT_FMT = "<3sHcBBI"  # 12 bytes
_STRUCT = struct.Struct(STRUCT_FMT)


def pack_line(line: str) -> bytes:
    """Convierte una línea a 12 bytes binarios."""

    compact = _compact(line)
    m = PATTERN.match(compact)
    if not m:
        raise ValueError(f"Línea mal formada: {line!r}")

    city   = m.group("city").encode("ascii")
    num1   = int(m.group("num1"))
    letter = m.group("letter").encode("ascii")
    num2   = int(m.group("num2"))
    char2  = char_to_hex_value(m.group("char2"))
    time_val = int(m.group("time"))

    # --- Validaciones ----
    if not (0 <= num1 <= 9999):
        raise ValueError("num1 fuera de rango (0‑9999)")
    if not (0 <= num2 <= 255):
        raise ValueError("num2 fuera de rango (0‑255)")
    if not (0 <= char2 <= 0x1A):
        raise ValueError("char2 fuera de rango (A‑Z o 0‑9)")
    if not (0 <= time_val <= 0xFFFFFFFF):
        raise ValueError("tiempo fuera de rango (0‑4 294 967 295)")

    return _STRUCT.pack(city, num1, letter, num2, char2, time_val)


# ------------------ Pretty print ------------------------------------------ #

def pretty_line(line: str) -> str:
    """Devuelve la línea formateada, con *char2* como valor y hex."""

    compact = _compact(line)
    m = PATTERN.match(compact)
    if not m:
        return line.strip()

    char2 = m.group("char2")
    hex_val = char_to_hex_value(char2)
    return (
        f"{m.group('city')} "
        f"{int(m.group('num1')):04d} "
        f"{m.group('letter')} "
        f"{int(m.group('num2')):03d} "
        f"{char2}(0x{hex_val:X}) "
        f"{int(m.group('time')):010d}"
    )

# ------------------ CLI ---------------------------------------------------- #

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Envía registros con char2 en hexadecimal y time de hasta 10 dígitos",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    #p.add_argument("file", type=Path, help="Fichero de entrada")
    p.add_argument("port", help="Puerto serie (p.ej. /dev/ttyACM0 o COM3)")
    p.add_argument("--baud", type=int, default=DEFAULT_BAUD, help="Velocidad en baudios")
    p.add_argument(
        "--pause",
        type=float,
        default=PAUSE_BETWEEN_LINES,
        help="Pausa entre líneas para no saturar el buffer (seg.)",
    )
    return p.parse_args()

# ------------------ Programa principal ------------------------------------ #

def main(args) -> None:

    #if not args.file.exists():
    #    raise SystemExit(f"Archivo no encontrado: {args.file}")

    try:
        with serial.Serial(args.port, args.baud, timeout=1) as ser:
            print(
                f"Enviando registros a {args.port} "
                f"@ {args.baud} baudios… (12 bytes/registro)"
            )
            line_num = 0
            total_bytes = 0
            for raw in read_db("vueling.db","vueling3"):
                line_num += 1
                if not raw.strip():
                    continue

                try:
                    packed = pack_line(raw)
                except ValueError as e:
                    print(f"[Línea {line_num}] ERROR: {e}")
                    continue

                ser.write(packed)
                total_bytes += len(packed)

                hex_bytes = " ".join(f"{b:02X}" for b in packed)
                print(f"[{line_num:3}] {pretty_line(raw):44} -> {hex_bytes}")

                time.sleep(args.pause)

            print(f"\nEnviados {total_bytes} bytes en {line_num} registros.")
    except serial.SerialException as e:
        raise SystemExit(f"Error de puerto serie: {e}")
    except KeyboardInterrupt:
        print("\nInterrumpido por el usuario.")


if __name__ == "__main__":
    while True:
        main(parse_args())
        time.sleep(10)