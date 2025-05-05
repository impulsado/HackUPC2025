/*─────────────────────────────────────────────────────────────────────────────
  Arduino 101  ·  Serial‑to‑BLE Gateway
  ─────────────────────────────────────────────────────────────────────────────
  Reads up to 20 bytes from the UART (USB Serial) and forwards them unchanged
  as BLE notifications. The packet size is capped by the ATT MTU of 20 bytes,
  so each write fits in a single notification.

  Tested on: Intel® Curie / Arduino 101
  Dependencies: CurieBLE.h (built‑in for Arduino 101)
─────────────────────────────────────────────────────────────────────────────*/

#include <CurieBLE.h>

/*──────────── System‑wide configuration ───────────────────────────────────*/
constexpr size_t   MAX_PACKET   = 20;      // 20 B = single BLE notification
constexpr uint32_t SERIAL_BAUD  = 115'200; // UART speed (match Python script)
constexpr uint32_t SERIAL_WAIT  = 50;      // ms to wait for incoming bytes
constexpr uint32_t NOTIFY_DELAY = 10;      // ms between notifications

/*──────────── BLE service & characteristic (128‑bit UUIDs) ────────────────*/
BLEService vuelingService("f9e47602-1b6d-4e3d-bc39-9a13b6a9c340");

BLECharacteristic flightsChar(
  "c3a5d703-44c7-4fd2-9f19-dfc1c7d95a1a",
  BLERead | BLENotify,                // properties
  MAX_PACKET                          // attribute length
);

char txBuf[MAX_PACKET];               // Scratch buffer برای outgoing data

/*───────────────── Arduino setup() ─────────────────────────────────────────*/
void setup() {
  /* Start USB‑Serial and wait until the host opens the port
     (required on some IDEs / OSs to avoid missing early prints). */
  Serial.begin(SERIAL_BAUD);
  while (!Serial) /* spin */ ;

  /* Initialise the BLE stack; halt if initialisation fails. */
  if (!BLE.begin()) {
    Serial.println("⚠ BLE initialisation failed.");
    while (true) /* trap */ ;
  }

  /* Advertise as “VuelingGATT” and expose custom service/char. */
  BLE.setLocalName("VuelingGATT");
  BLE.setAdvertisedService(vuelingService);
  vuelingService.addCharacteristic(flightsChar);
  BLE.addService(vuelingService);

  /* Provide an initial value so central devices can read something
     even before notifications start.                                */
  flightsChar.setValue(reinterpret_cast<uint8_t const*>("Start"), 5);

  BLE.advertise();
  Serial.println("Ready: send ≤20 bytes over Serial and connect via BLE.");
}

/*───────────────── Arduino loop() ─────────────────────────────────────────*/
void loop() {
  BLEDevice central = BLE.central();  // Non‑blocking poll

  /* No central connected → just drain the Serial RX buffer so it
     doesn’t overflow while we wait for a phone / tablet to pair.  */
  if (!central) {
    flushSerial();
    return;
  }

  Serial.print("Central connected: ");
  Serial.println(central.address());

  /* While the central device stays connected, forward UART → BLE. */
  while (central.connected()) {

    /* Wait for data or until SERIAL_WAIT elapses (poor‑man’s timeout). */
    unsigned long t0 = millis();
    while (Serial.available() == 0 && central.connected()) {
      if (millis() - t0 > SERIAL_WAIT) break;     // no data for 50 ms
    }

    int nAvail = Serial.available();
    if (nAvail <= 0) continue;                    // nothing to send

    /* Read up to MAX_PACKET bytes into txBuf. readBytes() blocks
       only for the bytes requested, so we cap it at min(nAvail,20). */
    int nRead = Serial.readBytes(txBuf, min(nAvail, static_cast<int>(MAX_PACKET)));

    /* Transmit to central as a single GATT notification (no fragmentation). */
    flightsChar.writeValue(reinterpret_cast<uint8_t*>(txBuf), nRead);

    /* Serial echo for debugging / monitoring throughput. */
    Serial.print("TX (");
    Serial.print(nRead);
    Serial.print(" B): ");
    for (int i = 0; i < nRead; ++i) Serial.write(txBuf[i]);
    Serial.println();

    delay(NOTIFY_DELAY);            // short pause to keep the link stable
  }

  Serial.println("Central disconnected.");
}

/*────────── Helper: empty Serial RX when not connected ────────────────────*/
void flushSerial() {
  while (Serial.available()) Serial.read();
}