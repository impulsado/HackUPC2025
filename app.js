// ─── BLE UUIDs ───────────────────────────────────────────────
const SERVICE_UUID = 'f9e47602-1b6d-4e3d-bc39-9a13b6a9c340';
const CHARACTERISTIC_UUID = 'c3a5d703-44c7-4fd2-9f19-dfc1c7d95a1a';

// ─── DOM references ─────────────────────────────────────────
const scanBtn = document.getElementById('scan');
const filterI = document.getElementById('filter');
const thead   = document.querySelector('#table thead');
const tbody   = document.querySelector('#table tbody');
const logPre  = document.getElementById('log');

// ─── State ─────────────────────────────────────────────────
const flights = new Map();
let sortCol = 'time';
let sortAsc = false;

// ─── Helpers ───────────────────────────────────────────────
const bytesToHex = buf => [...new Uint8Array(buf)]
  .map(b => b.toString(16).padStart(2,'0')).join(' ');

const statusText = status => {
  switch (status) {
    case 0:  return 'Scheduled';
    case 1:  return 'Boarding';
    case 2:  return 'Delayed';
    case 3:  return 'Canceled';
    case 4:  return 'Departed';
    case 5:  return 'Arrived';
    default: return 'Unknown';
  }
};

const statusClass = status => {
  switch (status) {
    case 0:  return 'status-scheduled';
    case 1:  return 'status-boarding';
    case 2:  return 'status-delayed';
    case 3:  return 'status-canceled';
    case 4:  return 'status-departed';
    case 5:  return 'status-arrived';
    default: return '';
  }
};

function parsePacket(dv) {
  const len = dv.byteLength;
  const raw = bytesToHex(dv.buffer.slice(dv.byteOffset, dv.byteOffset + len));
  const txt = new TextDecoder();

  const airline  = txt.decode(new Uint8Array(dv.buffer, dv.byteOffset, Math.min(3,len))).trim();
  let off = 3;

  const flightNo = len >= off + 2 ? dv.getUint16(off,true) : 0; off += 2;
  const gateChr  = len >  off   ? String.fromCharCode(dv.getUint8(off)) : '?'; off += 1;
  const gateNum  = len >  off   ? dv.getUint8(off) : 0; off += 1;
  const flags    = len >  off   ? dv.getUint8(off) : 0; off += 1;
  const status   = (flags >> 1) & 0x07;

  let epoch = 0;
  if (len >= off + 4)      epoch = dv.getUint32(off,true);
  else if (len >= off + 2) epoch = dv.getUint16(off,true);

  return { airline, flightNo, gateChr, gateNum, status, epoch, raw };
}

const codeOf = p => `${p.airline}${String(p.flightNo).padStart(4,'0')}`;
const log    = m => (logPre.textContent += m + '\n');

// ─── Rendering ─────────────────────────────────────────────
function renderTable() {
  const query = filterI.value.trim().toUpperCase();

  const rows = [...flights.entries()].sort((a,b)=>{
    const da=a[1], db=b[1], mul=sortAsc?1:-1;
    switch(sortCol){
      case 'flight': return mul * a[0].localeCompare(b[0]);
      case 'gate':   return mul * (`${da.gateChr}${da.gateNum}`.localeCompare(`${db.gateChr}${db.gateNum}`));
      case 'status': return mul * (da.status - db.status);
      default:       return mul * (da.epoch - db.epoch);
    }
  });

  tbody.innerHTML = '';
  for (const [code,d] of rows){
    if (query && !code.startsWith(query)) continue;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td data-label="Flight">${code}</td>
      <td data-label="Gate">${d.gateChr}${d.gateNum}</td>
      <td data-label="Last update">${new Date(d.epoch*1000).toLocaleString()}</td>
      <td data-label="Status" class="${statusClass(d.status)}">${statusText(d.status)}</td>`;
    tbody.appendChild(tr);
  }
}

filterI.addEventListener('input', renderTable, {passive:true});

thead.addEventListener('click', ev => {
  const th = ev.target.closest('th');
  if(!th) return;
  const col = th.dataset.col;
  if(col === sortCol) sortAsc = !sortAsc; else { sortCol = col; sortAsc = true; }
  thead.querySelectorAll('th').forEach(el => el.classList.remove('sort-asc','sort-desc'));
  th.classList.add(sortAsc ? 'sort-asc' : 'sort-desc');
  renderTable();
});

// ─── BLE workflow ─────────────────────────────────────────
scanBtn.addEventListener('click', async () => {
  if(!('bluetooth' in navigator)) return alert('Web‑Bluetooth not supported in this browser');
  try{
    const device = await navigator.bluetooth.requestDevice({
      filters: [{ name: 'VuelingGATT' }],
      optionalServices: [SERVICE_UUID]
    });
    log(`▶ Selected: ${device.name || device.id}`);

    const server = await device.gatt.connect();
    const svc    = await server.getPrimaryService(SERVICE_UUID);
    const ch     = await svc.getCharacteristic(CHARACTERISTIC_UUID);
    await ch.startNotifications();
    log('📡 Notifications enabled');

    ch.addEventListener('characteristicvaluechanged', ev => {
      try{
        const p = parsePacket(ev.target.value);
        flights.set(codeOf(p), p);
        renderTable();
      } catch(e) { log(`⚠ Parse error: ${e.message}`); }
    });

    device.addEventListener('gattserverdisconnected', () => log('❌ Disconnected'));

  }catch(err){
    console.error(err);
    alert(err.message || err);
  }
});

// ─── Service Worker (deferred) ────────────────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./service-worker.js')
    .then(r => console.log('🔧 SW ready →', r.scope))
    .catch(err => console.warn('SW error', err));
}

export {};