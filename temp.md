# Flights Information

> **Ultra‑light, offline‑first flight board** that keeps running on a tiny Arduino 101 and a phone browser—even if the terminal loses mains power.

Live site → [https://flights-information.co](https://flights-information.co)

---

## Why we built it

During a blackout at a regional airport we saw passengers crowd around one overwhelmed gate agent. We wanted a *self‑contained* tool that:

* **Runs from a USB power‑bank**—no servers, no Wi‑Fi.
* **Needs only one microcontroller** (Arduino 101) already on hand.
* Works with any modern phone or tablet through **Web Bluetooth**.

---

## Feature Highlights

* **Desktop form** – Enter or modify flights via Dear PyGui.
* **Single‑file DB** – SQLite keeps data safe on the operator’s laptop.
* **Serial‑to‑BLE bridge** – Arduino 101 forwards each 12‑byte record.
* **PWA dashboard** – Interactive table with live updates, filter, sort & pagination.
* **Offline capable** – Service Worker caches the PWA so passengers can reload the page even with no connectivity.

---

## System Overview

```text
+--------------+       USB/UART      +-------------+   BLE Notify   +--------------+
| Dear PyGui   |  ───────────────▶  | Arduino 101 | ─────────────▶ | PWA Dashboard |
| (laptop)     |   12 B/record      |  (BLE 4.2)  |                | flights‑info  |
+--------------+                    +-------------+                +--------------+
```

---

## Quick Start

1. **Insert / update flights** on the operator PC:

   ```bash
   python gui_insert.py
   ```
2. **Stream the table** to the Arduino 101 (change port as needed):

   ```bash
   python send_serial.py /dev/ttyACM0   # macOS / Linux
   # or
   python send_serial.py COM3           # Windows
   ```
3. **Serve the PWA** from your laptop (HTTPS is mandatory for Web Bluetooth):

4. Tap **Connect** on the webpage, pick **VuelingGATT** and watch updates appear.

*(All four steps work powered only by a USB power‑bank and a laptop battery.)*

---

## Tech Stack

| Layer       | Technology                                            |
| ----------- | ----------------------------------------------------- |
| MCU         | **Arduino 101** · Intel® Curie · CurieBLE             |
| Desktop GUI | Python 3.11 · Dear PyGui · sqlite3                    |
| Transport   | PySerial ‑‑> UART 115 200 baud                        |
| Front‑end   | Vanilla JS (ES2023) · Web Bluetooth · Service Workers |

---

## Hardware Bill of Materials

| Item                  | Qty | Notes                        |
| --------------------- | --- | ---------------------------- |
| Arduino 101           | 1   | BLE 4.2 built‑in             |
| USB‑TTL cable         | 1   | Laptop ⇄ Arduino 101         |
| 10 000 mAh power bank | 1   | Keeps everything alive > 8 h |
| Low‑cost tablet       | 1+  | Any Android 10+ / iOS 14+    |