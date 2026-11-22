// Side activities for Brisa Sound — all playable, all paying:
// TAXI (pick up fares and drop them off), STREET RACE (timed checkpoint
// sprint with a saved best time), COURIER (5 parcel pickups), and NEON ORBS
// (8 glowing collectibles hidden around the city). Each is a small state
// machine driven by the player's position; the HUD shows the active job.
import { dist2D } from './random.js';

export const TAXI_STANDS = [
  { x: -60, z: 60, name: 'PALM ROW STAND' },
  { x: 60, z: 120, name: 'MARINA STAND' },
  { x: -120, z: -60, name: 'NEON MILE STAND' },
];

export const RACE_START = { x: 0, z: 60, name: 'SPAN RACE START' };
export const RACE_GATES = [
  { x: 120, z: 60 }, { x: 120, z: -60 }, { x: 0, z: -60 }, { x: -120, z: -60 },
];

export const PARCELS = [
  { x: 210, z: 90 }, { x: -150, z: 150 }, { x: 90, z: -150 },
  { x: -180, z: -30 }, { x: 30, z: 180 },
];

export const ORBS = [
  { x: 190, z: 0 }, { x: -30, z: -150 }, { x: 150, z: 150 },
  { x: -180, z: 90 }, { x: 60, z: -180 }, { x: 240, z: -60 },
  { x: -90, z: 180 }, { x: 120, z: -120 },
];

export class SideActivities {
  constructor(scene) {
    this.scene = scene;
    this.taxi = { state: 'idle', pickup: null, drop: null, fare: 0 };
    this.race = { state: 'idle', gate: 0, time: 0, best: null };
    this.courier = { state: 'idle', collected: 0, done: false };
    this.orbs = { collected: 0, remaining: ORBS.map((o) => ({ ...o, taken: false })) };
    this.markers = [];
    this.loadBest();
  }

  loadBest() {
    try {
      const raw = localStorage.getItem('brisa-sound-race-best');
      if (raw) this.race.best = parseFloat(raw);
    } catch { /* ignore */ }
  }

  saveBest() {
    try { localStorage.setItem('brisa-sound-race-best', String(this.race.best)); } catch { /* ignore */ }
  }

  nearestStand(x, z, maxDist = 12) {
    let best = null, bd = maxDist;
    for (const s of TAXI_STANDS) {
      const d = dist2D(x, z, s.x, s.z);
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  }

  nearRaceStart(x, z) {
    return dist2D(x, z, RACE_START.x, RACE_START.z) < 12;
  }

  startTaxi(playerPos, rngPick) {
    if (this.taxi.state !== 'idle') return null;
    const spots = [
      { x: 120, z: -60 }, { x: -120, z: 120 }, { x: 60, z: -180 },
      { x: 180, z: 30 }, { x: -60, z: -120 }, { x: 0, z: 180 },
    ];
    const drops = [
      { x: 250, z: -90 }, { x: -180, z: 60 }, { x: 90, z: 150 },
      { x: -30, z: -180 }, { x: 210, z: 120 }, { x: -150, z: -150 },
    ];
    const i = Math.floor(Math.random() * spots.length);
    this.taxi = { state: 'pickup', pickup: spots[i], drop: drops[i], fare: 150 + Math.floor(Math.random() * 200) };
    return { type: 'taxi-start', pickup: this.taxi.pickup, fare: this.taxi.fare };
  }

  startRace() {
    if (this.race.state !== 'idle') return null;
    this.race = { state: 'running', gate: 0, time: 0, best: this.race.best };
    return { type: 'race-start', gates: RACE_GATES.length };
  }

  startCourier() {
    if (this.courier.state !== 'idle') return null;
    this.courier = { state: 'running', collected: 0, done: false };
    return { type: 'courier-start', total: PARCELS.length };
  }

  // Returns events for the HUD/toasts. `pos` is the player position.
  update(dt, pos, inCar) {
    const events = [];
    // Taxi.
    if (this.taxi.state === 'pickup' && dist2D(pos.x, pos.z, this.taxi.pickup.x, this.taxi.pickup.z) < 9) {
      this.taxi.state = 'drop';
      events.push({ type: 'taxi-pickup', drop: this.taxi.drop });
    } else if (this.taxi.state === 'drop' && dist2D(pos.x, pos.z, this.taxi.drop.x, this.taxi.drop.z) < 9) {
      const fare = this.taxi.fare;
      this.taxi = { state: 'idle', pickup: null, drop: null, fare: 0 };
      events.push({ type: 'taxi-done', money: fare });
    }
    // Race.
    if (this.race.state === 'running') {
      this.race.time += dt;
      const gate = RACE_GATES[this.race.gate];
      if (gate && dist2D(pos.x, pos.z, gate.x, gate.z) < 10) {
        this.race.gate++;
        if (this.race.gate >= RACE_GATES.length) {
          const t = this.race.time;
          const isBest = this.race.best == null || t < this.race.best;
          if (isBest) { this.race.best = t; this.saveBest(); }
          this.race.state = 'idle';
          events.push({ type: 'race-done', money: 800, time: t, best: isBest });
        } else {
          events.push({ type: 'race-gate', gate: this.race.gate, total: RACE_GATES.length });
        }
      } else if (this.race.time > 120) {
        this.race.state = 'idle';
        events.push({ type: 'race-failed' });
      }
    }
    // Courier parcels.
    if (this.courier.state === 'running') {
      const p = PARCELS[this.courier.collected];
      if (p && dist2D(pos.x, pos.z, p.x, p.z) < 7) {
        this.courier.collected++;
        if (this.courier.collected >= PARCELS.length) {
          this.courier = { state: 'idle', collected: 0, done: true };
          events.push({ type: 'courier-done', money: 500 });
        } else {
          events.push({ type: 'courier-pickup', n: this.courier.collected, total: PARCELS.length });
        }
      }
    }
    // Neon orbs (always collectible).
    for (const o of this.orbs.remaining) {
      if (!o.taken && dist2D(pos.x, pos.z, o.x, o.z) < 5) {
        o.taken = true;
        this.orbs.collected++;
        events.push({ type: 'orb', money: 50, n: this.orbs.collected, total: ORBS.length });
      }
    }
    return events;
  }

  // Current navigation target for the beacon/minimap, if any side job is live.
  currentTarget() {
    if (this.taxi.state === 'pickup') return this.taxi.pickup;
    if (this.taxi.state === 'drop') return this.taxi.drop;
    if (this.race.state === 'running') return RACE_GATES[this.race.gate];
    if (this.courier.state === 'running') return PARCELS[this.courier.collected];
    return null;
  }

  statusLine() {
    if (this.taxi.state === 'pickup') return `TAXI — PICK UP FARE ($${this.taxi.fare})`;
    if (this.taxi.state === 'drop') return `TAXI — DROP OFF FARE ($${this.taxi.fare})`;
    if (this.race.state === 'running') return `RACE — GATE ${this.race.gate + 1}/${RACE_GATES.length} • ${this.race.time.toFixed(1)}s${this.race.best ? ` • BEST ${this.race.best.toFixed(1)}s` : ''}`;
    if (this.courier.state === 'running') return `COURIER — PARCELS ${this.courier.collected}/${PARCELS.length}`;
    const parts = [];
    if (this.race.best) parts.push(`RACE BEST ${this.race.best.toFixed(1)}s`);
    parts.push(`ORBS ${this.orbs.collected}/${ORBS.length}`);
    return parts.join(' • ') + '  —  T taxi • R race • C courier';
  }
}
