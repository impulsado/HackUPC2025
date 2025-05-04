#!/usr/bin/env python3
"""
init_db.py  ·  Create / reset the Flights Information SQLite database.

Usage
-----
$ python init_db.py                 # creates vueling.db in current folder
$ python init_db.py --db path/to.db # custom DB location
$ python init_db.py --reset         # drops table if it already exists
"""
import argparse
import sqlite3
from pathlib import Path

DDL = """
CREATE TABLE IF NOT EXISTS information (
    airline    CHAR(3),
    flight_no  SMALLINT PRIMARY KEY,
    gate_char  CHAR(1),
    gate_num   TINYINT,
    flags      CHAR(1),
    epoch      INTEGER
);
"""

def create_db(db_path: Path, reset: bool) -> None:
    """Create the database file and the *information* table."""
    with sqlite3.connect(db_path) as conn:
        cur = conn.cursor()

        if reset:
            cur.execute("DROP TABLE IF EXISTS information")

        cur.executescript(DDL)
        conn.commit()

    print(f"✔ Database ready → {db_path.resolve()}")

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Create the Flights Information SQLite database."
    )
    parser.add_argument(
        "--db", default="vueling.db", metavar="FILE",
        help="destination .db file (default: %(default)s)"
    )
    parser.add_argument(
        "--reset", action="store_true",
        help="drop existing table before creating it"
    )
    args = parser.parse_args()

    create_db(Path(args.db), args.reset)

if __name__ == "__main__":
    main()