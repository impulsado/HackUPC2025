// ─── BLE UUIDs ───────────────────────────────────────────────
const SERVICE_UUID        = 'f9e47602-1b6d-4e3d-bc39-9a13b6a9c340';
const CHARACTERISTIC_UUID = 'c3a5d703-44c7-4fd2-9f19-dfc1c7d95a1a';

// ─── DOM refs ───────────────────────────────────────────────
const scanBtn  = document.getElementById('scan');
const filterI  = document.getElementById('filter');
const thead    = document.querySelector('#table thead');
const tbody    = document.querySelector('#table tbody');
const logPre   = document.getElementById('log');
const prevBtn  = document.getElementById('prev');
const nextBtn  = document.getElementById('next');
const pageInfo = document.getElementById('pageInfo');

// ─── State & consts ─────────────────────────────────────────
const flights     = new Map();
let   sortCol     = 'time';
let   sortAsc     = false;
let   currentPage = 1;
const PAGE_SIZE   = 15;

const STATUS_NAMES  = ['Scheduled', 'Boarding', 'Delayed', 'Canceled', 'Departed', 'Arrived'];
const STATUS_CLASSES= ['status-scheduled','status-boarding','status-delayed',
                       'status-canceled','status-departed','status-arrived'];

// ─── Helpers ───────────────────────────────────────────────
const bytesToHex = buf => [...new Uint8Array(buf)]
  .map(b => b.toString(16).padStart(2,'0')).join(' ');

/** Acepta 0‑5 (ya normalizado) o 0,2,4,6,8,10,12,14 → devuelve 0‑5 */
const normStatus = raw => raw <= 5 ? raw : (raw >> 1);

const statusText  = s => STATUS_NAMES [normStatus(s)] || 'Unknown';
const statusClass = s => STATUS_CLASSES[normStatus(s)] || '';

function parsePacket(dv){
  const len = dv.byteLength;
  const txt = new TextDecoder();

  const airline = txt.decode(new Uint8Array(dv.buffer, dv.byteOffset, Math.min(3,len))).trim();
  let off = 3;

  const flightNo = len >= off+2 ? dv.getUint16(off,true) : 0; off += 2;
  const gateChr  = len >  off   ? String.fromCharCode(dv.getUint8(off)) : '?'; off += 1;
  const gateNum  = len >  off   ? dv.getUint8(off) : 0; off += 1;
  const flags    = len >  off   ? dv.getUint8(off) : 0; off += 1;

  // En el paquete llega 0‑5; en BD puede llegar duplicado (0,2,4…)
  const status   = (flags >> 1) & 0x07;   // 0‑5

  let epoch = 0;
  if(len >= off+4)      epoch = dv.getUint32(off,true);
  else if(len >= off+2) epoch = dv.getUint16(off,true);

  return { airline, flightNo, gateChr, gateNum, status, epoch };
}

const codeOf = p => `${p.airline}${String(p.flightNo).padStart(4,'0')}`;
const log    = m => (logPre.textContent += m + '\n');

// ─── Pagination ─────────────────────────────────────────────
function updatePager(total){
  pageInfo.textContent = `${currentPage} / ${total}`;
  prevBtn.disabled = currentPage===1;
  nextBtn.disabled = currentPage===total;
}

// ─── Rendering ─────────────────────────────────────────────
function renderTable(){
  const query = filterI.value.trim().toUpperCase();

  const sorted = [...flights.entries()].sort((a,b)=>{
    const da=a[1], db=b[1], mul=sortAsc?1:-1;
    switch(sortCol){
      case 'flight': return mul * a[0].localeCompare(b[0]);
      case 'gate':   return mul * (`${da.gateChr}${da.gateNum}`.localeCompare(`${db.gateChr}${db.gateNum}`));
      case 'status': return mul * (normStatus(da.status) - normStatus(db.status));
      default:       return mul * (da.epoch - db.epoch);
    }
  });

  const filtered = query ? sorted.filter(([code])=>code.startsWith(query)) : sorted;

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  if(currentPage > totalPages) currentPage = totalPages;
  updatePager(totalPages);

  const start = (currentPage-1)*PAGE_SIZE;
  const visible = filtered.slice(start, start + PAGE_SIZE);

  tbody.innerHTML = '';
  for(const [code,d] of visible){
    const tr=document.createElement('tr');
    tr.innerHTML = `
      <td data-label="Flight">${code}</td>
      <td data-label="Gate">${d.gateChr}${d.gateNum}</td>
      <td data-label="Last update">${new Date(d.epoch*1000).toLocaleString()}</td>
      <td data-label="Status" class="${statusClass(d.status)}">${statusText(d.status)}</td>`;
    tbody.appendChild(tr);
  }
}

filterI.addEventListener('input', ()=>{currentPage=1;renderTable();},{passive:true});

thead.addEventListener('click', ev=>{
  const th = ev.target.closest('th'); if(!th) return;
  const col = th.dataset.col;
  if(col===sortCol) sortAsc=!sortAsc; else { sortCol=col; sortAsc=true; }
  thead.querySelectorAll('th').forEach(el=>el.classList.remove('sort-asc','sort-desc'));
  th.classList.add(sortAsc?'sort-asc':'sort-desc');
  currentPage=1;
  renderTable();
});

prevBtn.addEventListener('click', ()=>{ if(currentPage>1){currentPage--; renderTable(); }});
nextBtn.addEventListener('click', ()=>{ currentPage++; renderTable(); });

// ─── BLE workflow ─────────────────────────────────────────
scanBtn.addEventListener('click', async ()=>{
  if(!('bluetooth' in navigator)) return alert('Web‑Bluetooth not supported');
  try{
    const device = await navigator.bluetooth.requestDevice({
      filters:[{name:'VuelingGATT'}],
      optionalServices:[SERVICE_UUID]
    });
    log(`▶ Selected: ${device.name||device.id}`);

    const server = await device.gatt.connect();
    const svc    = await server.getPrimaryService(SERVICE_UUID);
    const ch     = await svc.getCharacteristic(CHARACTERISTIC_UUID);
    await ch.startNotifications();
    log('📡 Notifications enabled');

    ch.addEventListener('characteristicvaluechanged', ev=>{
      try{
        const p = parsePacket(ev.target.value);
        flights.set(codeOf(p), p);
        renderTable();
      }catch(e){ log(`⚠ Parse error: ${e.message}`);}
    });

    device.addEventListener('gattserverdisconnected',()=>log('❌ Disconnected'));
  }catch(err){
    console.error(err);
    alert(err.message||err);
  }
});

// ─── Service Worker (opcional) ─────────────────────────────
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('./service-worker.js')
    .then(r=>console.log('🔧 SW ready →', r.scope))
    .catch(err=>console.warn('SW error', err));
}

export {};