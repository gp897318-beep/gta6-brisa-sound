// BRISA SOUND — hud.js: every HUD panel, as DOM overlays above the 3D canvas.
// Mission panel, clock/money/wanted, police dispatch, weapon slots, minimap,
// health/armor, speed, dialogue, radio, crew abilities and the current
// street/district — all DOM so they stay crisp in screenshots.
import { ROADS_X, ROADS_Z, districtAt, streetName } from './city.js';

const WEAPONS = [
  { key: '1', name: 'FISTS', ammo: '∞' },
  { key: '2', name: 'PISTOL', ammo: '48' },
  { key: '3', name: 'SMG', ammo: '120' },
  { key: '4', name: 'SHOTGUN', ammo: '24' },
  { key: '5', name: 'RIFLE', ammo: '60' },
  { key: '6', name: 'SNIPER', ammo: 'LOCKED' },
  { key: '7', name: 'BAT', ammo: '∞' },
];

export class HUD {
  constructor() {
    this.el = {};
    for (const id of [
      'mission-job', 'mission-name', 'mission-stage', 'mission-objective', 'mission-next',
      'mission-timer', 'mission-bar', 'clock', 'money', 'stars', 'wanted-label', 'respect',
      'dispatch-list', 'dispatch-count', 'weapons', 'health-fill', 'armor-fill',
      'health-num', 'armor-num', 'speed-num', 'car-name', 'car-condition',
      'dialog-box', 'dialog-name', 'dialog-role', 'dialog-text', 'dialog-face',
      'radio', 'crew', 'location', 'toast', 'objective-distance',
      'side-job', 'weather', 'garage-line',
    ]) this.el[id] = document.getElementById(id);
    this.minimap = document.getElementById('minimap');
    this.mm = this.minimap ? this.minimap.getContext('2d') : null;
    this.weaponIndex = 1;
    this.buildWeapons();
  }

  buildWeapons() {
    if (!this.el.weapons) return;
    this.el.weapons.innerHTML = WEAPONS.map((w, i) =>
      `<div class="weapon ${i === this.weaponIndex ? 'active' : ''} ${w.ammo === 'LOCKED' ? 'locked' : ''}">
        <span class="wkey">${w.key}</span><span class="wname">${w.name}</span>
        <span class="wammo">${w.ammo}</span></div>`).join('');
  }

  setWeapon(i) {
    this.weaponIndex = i;
    this.buildWeapons();
  }

  showDialog(name, role, text, faceColor = '#ffb36b') {
    if (!this.el['dialog-box']) return;
    this.el['dialog-name'].textContent = name;
    this.el['dialog-role'].textContent = role;
    this.el['dialog-text'].textContent = text;
    this.el['dialog-face'].style.background = faceColor;
    this.el['dialog-face'].textContent = name.trim()[0];
    this.el['dialog-box'].classList.add('visible');
  }

  hideDialog() {
    if (this.el['dialog-box']) this.el['dialog-box'].classList.remove('visible');
  }

  toast(text, ms = 2600) {
    if (!this.el.toast) return;
    this.el.toast.textContent = text;
    this.el.toast.classList.add('visible');
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => this.el.toast.classList.remove('visible'), ms);
  }

  fmtMoney(n) {
    return '$' + Math.floor(n).toLocaleString('en-US');
  }

  fmtTime(sec) {
    const s = Math.max(0, Math.ceil(sec));
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }

  update(state) {
    const e = this.el;
    // Mission panel.
    if (e['mission-job']) e['mission-job'].textContent = state.mission.job;
    if (e['mission-name']) e['mission-name'].textContent = state.mission.name;
    if (e['mission-stage']) e['mission-stage'].textContent = state.missionStage;
    if (e['mission-objective']) e['mission-objective'].textContent = state.objective;
    if (e['mission-next']) e['mission-next'].textContent = state.missionNext;
    if (e['mission-timer']) e['mission-timer'].textContent = state.timeLeft > 0 ? this.fmtTime(state.timeLeft) : '—';
    if (e['mission-bar']) e['mission-bar'].style.width = `${Math.round(state.missionProgress * 100)}%`;
    if (e['objective-distance']) {
      e['objective-distance'].textContent = state.targetDist != null ? `${Math.round(state.targetDist)}m` : '';
    }
    // Clock / money / wanted.
    if (e.clock) e.clock.textContent = state.clock;
    if (e.money) e.money.textContent = this.fmtMoney(state.money);
    if (e.stars) {
      e.stars.textContent = '★'.repeat(state.wanted) + '☆'.repeat(5 - state.wanted);
      e.stars.classList.toggle('hot', state.wanted >= 3);
    }
    if (e['wanted-label']) {
      e['wanted-label'].textContent = state.wanted === 0 ? 'CLEAN' : state.wanted >= 3 ? 'IN SIGHT — HELI UP' : 'WANTED';
      e['wanted-label'].classList.toggle('hot', state.wanted > 0);
    }
    if (e.respect) e.respect.textContent = `RESPECT ${state.respect}  •  RANK ${state.rank}`;
    // Dispatch: show at most 5 units so the panel never covers the weapons.
    if (e['dispatch-count']) e['dispatch-count'].textContent = `${state.dispatch.length} UNITS`;
    if (e['dispatch-list']) {
      const shown = state.dispatch.slice(0, 5);
      e['dispatch-list'].innerHTML = state.dispatch.length === 0
        ? '<div class="dispatch-row clear">NO ACTIVE PURSUIT — BRISA PD STANDBY</div>'
        : shown.map((u) =>
          `<div class="dispatch-row"><span class="dname">${u.name}</span>
           <span class="ddist">${u.dist}m</span><span class="dstatus">${u.status}</span></div>`).join('')
          + (state.dispatch.length > 5 ? `<div class="dispatch-row more">… +${state.dispatch.length - 5} MORE UNIT</div>` : '');
    }
    // Health / armor.
    if (e['health-fill']) e['health-fill'].style.width = `${state.health}%`;
    if (e['armor-fill']) e['armor-fill'].style.width = `${state.armor}%`;
    if (e['health-num']) e['health-num'].textContent = Math.round(state.health);
    if (e['armor-num']) e['armor-num'].textContent = Math.round(state.armor);
    // Speed + car.
    if (e['speed-num']) e['speed-num'].textContent = Math.round(Math.abs(state.speedKmh));
    if (e['car-name']) e['car-name'].textContent = state.inCar ? state.carName : 'ON FOOT';
    if (e['car-condition']) e['car-condition'].textContent = state.inCar ? `CONDITION ${Math.round(state.carCondition)}%` : 'E — ENTER NEARBY CAR';
    // Radio / crew / location / side jobs / weather / garage.
    if (e.radio) e.radio.textContent = `♪ ${state.radio}`;
    if (e['side-job']) e['side-job'].textContent = state.sideLine || '';
    if (e.weather) e.weather.textContent = state.weather || 'DUSK — CLEAR';
    if (e['garage-line']) {
      e['garage-line'].textContent = state.garage
        ? `GARAGE — ENG LV${state.garage.engine} • ARMOR LV${state.garage.armor} • NITRO ${state.garage.nitro > 0 ? 'LV' + state.garage.nitro : '—'}  (G)`
        : '';
    }
    if (e.crew) {
      e.crew.innerHTML = state.crew.map((c) =>
        `<div class="crew-item ${c.ready ? '' : 'cooling'}"><b>${c.name}</b><span>${c.desc}</span></div>`).join('');
    }
    if (e.location) {
      e.location.textContent = state.standing != null
        ? `${state.street}  •  ${state.district} — STANDING ${state.standing}`
        : `${state.street}  •  ${state.district}`;
    }
    this.drawMinimap(state);
  }

  drawMinimap(state) {
    if (!this.mm) return;
    const g = this.mm;
    const S = 180, C = S / 2, scale = S / 560;
    g.clearRect(0, 0, S, S);
    // Circle clip.
    g.save();
    g.beginPath(); g.arc(C, C, C - 2, 0, Math.PI * 2); g.clip();
    g.fillStyle = 'rgba(16,12,28,0.92)';
    g.fillRect(0, 0, S, S);
    const toMap = (x, z) => [C + x * scale, C + z * scale];
    // Water east.
    g.fillStyle = '#274b7a';
    g.fillRect(C + 168 * scale, 0, S, S);
    g.fillStyle = '#c9a06a';
    g.fillRect(C + 228 * scale, 0, 14, S);
    // Roads.
    g.strokeStyle = '#5a5470'; g.lineWidth = 5;
    for (const x of ROADS_X) {
      const [mx] = toMap(x, 0);
      g.beginPath(); g.moveTo(mx, 0); g.lineTo(mx, S); g.stroke();
    }
    for (const z of ROADS_Z) {
      const [, mz] = toMap(0, z);
      g.beginPath(); g.moveTo(0, mz); g.lineTo(S, mz); g.stroke();
    }
    // Bridge.
    g.strokeStyle = '#ff4dd2'; g.lineWidth = 4;
    g.beginPath();
    const [bx0] = toMap(150, 0); const [bx1] = toMap(250, 0);
    g.moveTo(bx0, C); g.lineTo(bx1, C); g.stroke();
    // Objective marker.
    if (state.target) {
      const [tx, tz] = toMap(state.target.x, state.target.z);
      g.fillStyle = '#ffd23f';
      g.beginPath(); g.arc(tx, tz, 6, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#ffd23f'; g.lineWidth = 2;
      g.beginPath(); g.arc(tx, tz, 10 + Math.sin(Date.now() / 300) * 2, 0, Math.PI * 2); g.stroke();
    }
    // Police dots.
    g.fillStyle = '#ff3344';
    for (const u of state.policeDots || []) {
      const [px, pz] = toMap(u.x, u.z);
      g.beginPath(); g.arc(px, pz, 3.5, 0, Math.PI * 2); g.fill();
    }
    // Player arrow (rotates with heading).
    const [px, pz] = toMap(state.player.x, state.player.z);
    g.save();
    g.translate(px, pz);
    g.rotate(state.heading);
    g.fillStyle = '#ffffff';
    g.beginPath(); g.moveTo(0, -8); g.lineTo(5, 6); g.lineTo(-5, 6); g.closePath(); g.fill();
    g.restore();
    g.restore();
    // Ring + N.
    g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 2;
    g.beginPath(); g.arc(C, C, C - 2, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#ffd23f'; g.font = 'bold 13px sans-serif'; g.textAlign = 'center';
    g.fillText('N', C, 16);
  }

  static streetAndDistrict(x, z) {
    return { street: streetName(x, z), district: districtAt(x, z) };
  }
}
