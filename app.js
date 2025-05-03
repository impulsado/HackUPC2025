/* UUIDs --------------------------------------------------------- */
const SERVICE_UUID        = 'f9e47602-1b6d-4e3d-bc39-9a13b6a9c340';
const CHARACTERISTIC_UUID = 'c3a5d703-44c7-4fd2-9f19-dfc1c7d95a1a';

/* DOM ----------------------------------------------------------- */
const scanBtn = document.getElementById('scan');
const tbody   = document.querySelector('#table tbody');
const logPre  = document.getElementById('log');

/* Mapas --------------------------------------------------------- */
const flights = new Map();   // datos por vuelo
const rows    = new Map();   // <tr> por vuelo

/* Helpers ------------------------------------------------------- */
const codeFrom = p =>
  `${p.airline}${String(p.flightNo).padStart(4, '0')}`;

function parsePacket(dv) {
  const len = dv.byteLength;          // Bytes reales recibidos
  const txt = new TextDecoder();

  // airline → máximo 3 bytes o los que haya
  const airlineBytes = new Uint8Array(dv.buffer, dv.byteOffset, Math.min(3, len));
  const airline = txt.decode(airlineBytes).replace(/\0/g, '');

  let offset = 3;

  const flightNo = len >= offset + 2 ? dv.getUint16(offset, true) : 0;
  offset += 2;

  const gateChr = len > offset     ? String.fromCharCode(dv.getUint8(offset)) : '?';
  offset += 1;

  const gateNum = len > offset     ? dv.getUint8(offset) : 0;
  offset += 1;

  const flags   = len > offset     ? dv.getUint8(offset) : 0;
  offset += 1;

  const epoch   = len >= offset+4  ? dv.getUint32(offset, true) : 0;

  return { airline, flightNo, gateChr, gateNum, flags, epoch };
}


function upsertRow(code, d) {
  let tr = rows.get(code);
  if (!tr) {
    tr = document.createElement('tr');
    rows.set(code, tr);
    tbody.appendChild(tr);
  }
  tr.innerHTML = `
    <td>${code}</td>
    <td>${d.gateChr}${d.gateNum}</td>
    <td>${d.timestamp.toLocaleString()}</td>
    <td>${d.flags}</td>`;
}

function log(msg) {
  logPre.textContent += msg + '\n';
}

/* BLE ----------------------------------------------------------- */
scanBtn.addEventListener('click', async () => {
  if (!('bluetooth' in navigator)) {
    alert('Este navegador no soporta Web‑Bluetooth.');
    return;
  }
  try {
    const device = await navigator.bluetooth.requestDevice({
      filters: [{ name: 'VuelingGATT' }],
      optionalServices: [SERVICE_UUID]
    });
    log(`▶ Dispositivo seleccionado: ${device.name || device.id}`);

    const server = await device.gatt.connect();
    const service = await server.getPrimaryService(SERVICE_UUID);
    const ch = await service.getCharacteristic(CHARACTERISTIC_UUID);
    await ch.startNotifications();
    log('📡 Notificaciones activadas');

    ch.addEventListener('characteristicvaluechanged', ev => {
      console.log('Bytes recibidos:', ev.target.value.byteLength);
      const p = parsePacket(ev.target.value);
      const code = codeFrom(p);
      flights.set(code, { ...p, timestamp: new Date(p.epoch * 1000) });
      upsertRow(code, flights.get(code));
    });

    device.addEventListener('gattserverdisconnected',
      () => log('❌ Desconectado'));

  } catch (err) {
    console.error(err);
    alert(err.message);
  }
});