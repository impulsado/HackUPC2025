import sqlite3
from dearpygui import dearpygui as dpg
from datetime import datetime

STATUS_NAMES  = ("Scheduled", "Boarding", "Delayed", "Canceled", "Departed", "Arrived")
REAL_STATUS = ("0", "2", "4", "6", "8", "A")

def actualitzar_db(sender, appdata):
    airline = dpg.get_value(airline_fld)
    flight_no = dpg.get_value(flight_no_fld)
    gate_char = dpg.get_value(gate_char_fld)
    gate_num = dpg.get_value(gate_num_fld)
    flag = dpg.get_value(flag_fld)
    #hour = dpg.get_value(hour_fld)
    #min = dpg.get_value(min_fld)
    #date = dpg.get_value(date_fld)

    index = STATUS_NAMES.index(flag)
    flag = REAL_STATUS[index]
    
    #timestamp_str = datetime.now() #str(date["year"]+1900) + "-" + str(date["month"]) +"-"+str(date["month_day"]) + " " + str(hour) + ":" + str(min)+":00"
    #print(timestamp_str)
    timestamp = int(datetime.now().timestamp())
    print(timestamp)
    connection = sqlite3.connect("./db/vueling.db")

    cursor = connection.cursor()
    try:
        sql = f'INSERT INTO information VALUES("{airline}",{flight_no},"{gate_char}",{gate_num},"{flag}",{timestamp})'
        print(sql)
        cursor.execute(sql)
        dpg.configure_item("afegit", show=True)
    except :
        sql2 = f'UPDATE information SET airline = "{airline}",gate_char ="{gate_char}",gate_num = {gate_num}, flags ="{flag}", epoch={timestamp} WHERE flight_no = {flight_no}'
        print(sql2)
        dpg.configure_item("act", show=True)
        cursor.execute(sql2)

    connection.commit()

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
    #hour_fld = dpg.add_input_int(label="Hour", default_value=0, max_value=23, width=400)
    #min_fld = dpg.add_input_int(label="Minute", default_value=0, max_value=59, width=400)
    #date_fld = dpg.add_date_picker(default_value={ 'month_day':  int(datetime.now().day), 'month': int(datetime.now().month)-1, 'year': int(datetime.now().year)-1900})


    dpg.add_button(label="Submit", callback=actualitzar_db)
    dpg.add_text("Flight Added", id="afegit",tag="afegit", show=False)
    dpg.add_text("Flight Updated", id="act",tag="act", show=False)
        

with dpg.font_registry():
    # first argument ids the path to the .ttf or .otf file
    default_font = dpg.add_font("./font/42dot_Sans/42dotSans-VariableFont_wght.ttf", 18    )


with dpg.window(label="Font Example", height=200, width=200, show=False):
    dpg.add_button(label="Default font")
    b2 = dpg.add_button(label="Secondary font")
    dpg.add_button(label="default")

    # set font of specific widget
    dpg.bind_font(default_font)


dpg.show_font_manager()

dpg.create_viewport(title="Add/Modify Flights", width=800, height=600, max_height=600, max_width=800)

dpg.setup_dearpygui()
dpg.show_viewport()
dpg.start_dearpygui()

dpg.destroy_context()