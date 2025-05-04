"""
Python GUI for inserting / updating flights in the `vueling.db`
SQLite database.  Uses Dear PyGui 1.x.
"""
import sqlite3
from datetime import datetime
from dearpygui import dearpygui as dpg

# ──────────────────────────────────────────────────────────────
# Constants
# ──────────────────────────────────────────────────────────────
STATUS_NAMES = ("Scheduled", "Boarding", "Delayed",
                "Canceled", "Departed", "Arrived")

# DB‑level status codes expected by the BLE/GATT stack
REAL_STATUS   = ("0", "2", "4", "6", "8", "A", "C", "E")

# ──────────────────────────────────────────────────────────────
# Callbacks
# ──────────────────────────────────────────────────────────────
def update_db(sender, appdata):
    """Insert a new flight or update an existing one."""

    # ── Read user input from widgets ──────────────────────────
    airline    = dpg.get_value(airline_fld).upper().strip()
    flight_no  = dpg.get_value(flight_no_fld)
    gate_char  = dpg.get_value(gate_char_fld).upper().strip()
    gate_num   = dpg.get_value(gate_num_fld)
    flag_label = dpg.get_value(flag_fld)
    hour       = dpg.get_value(hour_fld)
    minute     = dpg.get_value(min_fld)
    date_dict  = dpg.get_value(date_fld)     # Dear PyGui→dict

    # ── Convert “human” status → DB status code ───────────────
    status_idx = STATUS_NAMES.index(flag_label)
    flag_code  = REAL_STATUS[status_idx]

    # ── Build a POSIX timestamp (seconds since 1970‑01‑01) ────
    #   Dear PyGui delivers `year` as “years since 1900”.
    ts_str = f"{date_dict['year']+1900}-{date_dict['month']:02d}-{date_dict['month_day']:02d} " \
             f"{hour:02d}:{minute:02d}:00"
    epoch = int(datetime.strptime(ts_str, '%Y‑%m‑%d %H:%M:%S').timestamp())

    # ── Open DB connection (short‑lived) ──────────────────────
    with sqlite3.connect("vueling.db") as conn:
        cur = conn.cursor()

        try:
            # INSERT new record
            cur.execute("""
                INSERT INTO vueling3 (airline, flight_no, gate_char,
                                      gate_num, flags, epoch)
                VALUES (?,?,?,?,?,?)
            """, (airline, flight_no, gate_char, gate_num,
                  flag_code, epoch))
            dpg.configure_item("added_msg", show=True)

        except sqlite3.IntegrityError:
            # Primary‑key collision → UPDATE row
            cur.execute("""
                UPDATE vueling3
                   SET airline   = ?,
                       gate_char = ?,
                       gate_num  = ?,
                       flags     = ?,
                       epoch     = ?
                 WHERE flight_no = ?
            """, (airline, gate_char, gate_num, flag_code,
                  epoch, flight_no))
            dpg.configure_item("updated_msg", show=True)

# ──────────────────────────────────────────────────────────────
# Dear PyGui setup (widgets, theme, fonts, main loop)
# ──────────────────────────────────────────────────────────────
dpg.create_context()

with dpg.theme() as global_theme:
    with dpg.theme_component(dpg.mvAll):
        dpg.add_theme_color(dpg.mvThemeCol_TitleBgActive, (255, 204, 5), category=dpg.mvThemeCat_Core)
        dpg.add_theme_color(dpg.mvThemeCol_ButtonActive, (255, 204, 5), category=dpg.mvThemeCat_Core)
        dpg.add_theme_color(dpg.mvThemeCol_HeaderHovered, (255, 204, 5, 150), category=dpg.mvThemeCat_Core)
        dpg.add_theme_color(dpg.mvThemeCol_HeaderActive, (255, 204, 5), category=dpg.mvThemeCat_Core)
        dpg.add_theme_color(dpg.mvThemeCol_ButtonHovered, (57, 57, 58), category=dpg.mvThemeCat_Core)
        dpg.add_theme_color(dpg.mvThemeCol_CheckMark, (255, 204, 5), category=dpg.mvThemeCat_Core)
        dpg.add_theme_color(dpg.mvThemeCol_SliderGrab, (255, 204, 5), category=dpg.mvThemeCat_Core)
        dpg.add_theme_color(dpg.mvThemeCol_SliderGrabActive, (255, 204, 5), category=dpg.mvThemeCat_Core)
        dpg.add_theme_color(dpg.mvThemeCol_FrameBgHovered, (57, 57, 58), category=dpg.mvThemeCat_Core)
        dpg.add_theme_color(dpg.mvThemeCol_FrameBgActive, (67,67,68), category=dpg.mvThemeCat_Core)
        dpg.add_theme_style(dpg.mvStyleVar_FrameRounding, 0, category=dpg.mvThemeCat_Core)
dpg.bind_theme(global_theme)


with dpg.window(label="Insert flight", width=800, height=600):
    airline_fld = dpg.add_input_text(label="Airport code (3 characters)", default_value="BCN", width=400)
    flight_no_fld = dpg.add_input_int(label="Flight number(0000-9999)",default_value=9999,max_value=9999, width=400)
    gate_char_fld = dpg.add_input_text(label="Boarding Gate Letter(1 caracter)",default_value="A", width=400)
    gate_num_fld = dpg.add_input_int(label="Boarding Gate Number(000-255)", default_value=255,max_value=255 , width=400)
    flag_fld = dpg.add_combo(STATUS_NAMES,label="Status",default_value="Scheduled", width=400)
    hour_fld = dpg.add_input_int(label="Hour", default_value=0, max_value=23, width=400)
    min_fld = dpg.add_input_int(label="Minute", default_value=0, max_value=59, width=400)
    date_fld = dpg.add_date_picker(default_value={ 'month_day':  int(datetime.now().day), 'month': int(datetime.now().month)-1, 'year': int(datetime.now().year)-1900})


    dpg.add_button(label="Submit", callback=actualitzar_db)
    dpg.add_text("Flight Added", id="afegit",tag="afegit", show=False)
    dpg.add_text("Flight Updated", id="act",tag="act", show=False)
        

with dpg.font_registry():
    # first argument ids the path to the .ttf or .otf file
    default_font = dpg.add_font("font/42dot_Sans/42dotSans-VariableFont_wght.ttf", 18    )


with dpg.window(label="Font Example", height=200, width=200, show=False):
    dpg.add_button(label="Default font")
    b2 = dpg.add_button(label="Secondary font")
    dpg.add_button(label="default")

    # set font of specific widget
    dpg.bind_font(default_font)


dpg.show_font_manager()

dpg.create_viewport(title="Add / Modify Flights",
                    width=800, height=600,
                    max_width=800, max_height=600)

dpg.setup_dearpygui()
dpg.show_viewport()
dpg.start_dearpygui()
dpg.destroy_context()