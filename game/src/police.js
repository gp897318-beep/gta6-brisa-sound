// BRISA SOUND — police.js: wanted level, Brisa PD pursuit AI, helicopter.
// Wanted 1-5 stars: more stars = more units, faster cruisers, heli + spotlight.
// Units have named callsigns, live distances and tactics (PURSUE / RAMMING /
// FLANKING / ROADBLOCK / PIT / CLOSING IN) shown in the dispatch panel.
import '../vendor/three.min.js';
const THREE = window.THREE;
import { mulberry32, pick, clamp, angleLerp, dist2D } from './random.js';
import { buildCarMesh, CAR_MODELS } from './cars.js';

export const CALLSIGNS = [
  'UNIT 7 — VARGAS', 'UNIT 12 — OKONKWO', 'UNIT 3 — MARSH', 'UNIT 21 — DELGADO',
  'UNIT 9 — KOVAC', 'UNIT 15 — TRAN', 'UNIT 5 — IBARRA', 'UNIT 30 — HALE',
];
export const TACTICS = ['PURSUE', 'RAMMING', 'FLANKING', 'ROADBLOCK', 'PIT', 'CLOSING IN', 'SPOTLIGHT', 'FIRING'];

export const SWAT_CALLSIGNS = ['SWAT 1 — REYES', 'SWAT 2 — OKAFOR'];

export class Police {
  constructor(scene, seed) {
    this.scene = scene;
    this.rng = mulberry32(seed ^ 0x51f0);
    this.wanted = 0;
    this.heat = 0; // 0..100, decays when unseen
    this.units = [];
    this.heli = null;
    this.heliLight = null;
    this.heliRotor = null;
    this.spotAngle = 0;
    this.lastCrimeAt = 0;
  }

  addHeat(amount, now) {
    this.heat = clamp(this.heat + amount, 0, 100);
    this.lastCrimeAt = now;
    const target = this.heat < 12 ? 0 : this.heat < 30 ? 1 : this.heat < 50 ? 2
      : this.heat < 72 ? 3 : this.heat < 90 ? 4 : 5;
    if (target > this.wanted) this.wanted = target;
  }

  wantedCount() {
    return this.wanted === 0 ? 0 : this.wanted + 1; // 2..6 units
  }

  syncUnits(playerPos) {
    const want = this.wantedCount();
    while (this.units.length < want) {
      // At wanted 5 the last two units are SWAT vans, not cruisers.
      const idx = this.units.length;
      const isSwat = this.wanted >= 5 && idx >= 4;
      const mesh = buildCarMesh(isSwat ? CAR_MODELS[3] : CAR_MODELS[0], true);
      if (isSwat) mesh.scale.set(1.15, 1.15, 1.15);
      this.scene.add(mesh);
      const a = this.rng() * Math.PI * 2;
      const d = 55 + this.rng() * 30;
      this.units.push({
        mesh,
        callsign: isSwat ? SWAT_CALLSIGNS[idx - 4] : CALLSIGNS[idx % CALLSIGNS.length],
        swat: isSwat,
        x: playerPos.x + Math.cos(a) * d,
        z: playerPos.z + Math.sin(a) * d,
        heading: 0,
        speed: 0,
        tactic: 'PURSUE',
        tacticTimer: 0,
        topSpeed: 30 + this.wanted * 3.2,
      });
    }
    while (this.units.length > want) {
      const u = this.units.pop();
      this.scene.remove(u.mesh);
    }
    // Helicopter at wanted 3+.
    if (this.wanted >= 3 && !this.heli) {
      const heli = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(2.6, 1.6, 5.2),
        new THREE.MeshLambertMaterial({ color: 0x14161f }),
      );
      heli.add(body);
      const tail = new THREE.Mesh(
        new THREE.BoxGeometry(0.7, 0.7, 4.4),
        new THREE.MeshLambertMaterial({ color: 0x14161f }),
      );
      tail.position.set(0, 0.2, -4.2);
      heli.add(tail);
      const rotor = new THREE.Mesh(
        new THREE.BoxGeometry(9, 0.1, 0.5),
        new THREE.MeshLambertMaterial({ color: 0x888888 }),
      );
      rotor.position.y = 1.1;
      heli.add(rotor);
      this.heliRotor = rotor;
      const spot = new THREE.SpotLight(0xfff2b0, 2.2, 120, 0.28, 0.5, 1);
      heli.add(spot);
      heli.add(spot.target);
      spot.target.position.set(0, -40, 0);
      this.heliLight = spot;
      this.scene.add(heli);
      this.heli = heli;
    }
    if (this.wanted < 3 && this.heli) {
      this.scene.remove(this.heli);
      this.heli = null; this.heliLight = null; this.heliRotor = null;
    }
  }

  update(dt, playerPos, playerSpeed, city, now, onRam) {
    // Heat decays when the player stays clean and out of sight.
    if (now - this.lastCrimeAt > 14) this.heat = Math.max(0, this.heat - dt * 2.2);
    if (this.heat < 8 && this.wanted > 0 && now - this.lastCrimeAt > 20) {
      this.wanted = Math.max(0, this.wanted - 1);
      this.heat = this.wanted * 18;
      this.lastCrimeAt = now;
    }
    this.syncUnits(playerPos);
    for (const u of this.units) {
      u.tacticTimer -= dt;
      if (u.tacticTimer <= 0) {
        u.tactic = pick(this.rng, TACTICS.slice(0, 6));
        u.tacticTimer = 2.5 + this.rng() * 2.5;
      }
      const d = dist2D(u.x, u.z, playerPos.x, playerPos.z);
      let targetX = playerPos.x, targetZ = playerPos.z;
      let speedTarget = u.topSpeed;
      if (u.tactic === 'FLANKING') {
        const a = Math.atan2(playerPos.z - u.z, playerPos.x - u.x) + 0.9;
        targetX = playerPos.x + Math.cos(a) * 14;
        targetZ = playerPos.z + Math.sin(a) * 14;
      } else if (u.tactic === 'ROADBLOCK') {
        const a = Math.atan2(playerPos.z - u.z, playerPos.x - u.x);
        targetX = playerPos.x + Math.cos(a) * 22;
        targetZ = playerPos.z + Math.sin(a) * 22;
        speedTarget = u.topSpeed * 1.1;
      } else if (u.tactic === 'PIT') {
        targetX = playerPos.x - Math.sin(0) * 0;
        targetZ = playerPos.z;
        speedTarget = u.topSpeed * 1.05;
      }
      if (d < 4 && Math.abs(playerSpeed) > 2) {
        if (onRam) onRam(u);
        u.speed *= 0.4;
      }
      const desired = Math.atan2(targetX - u.x, targetZ - u.z);
      u.heading = angleLerp(u.heading, desired, Math.min(1, dt * 2.4));
      u.speed += (speedTarget - u.speed) * Math.min(1, dt * 0.9);
      if (d < 6) u.speed = Math.min(u.speed, 12);
      const nx = u.x + Math.sin(u.heading) * u.speed * dt;
      const nz = u.z + Math.cos(u.heading) * u.speed * dt;
      const fixed = city.collide(nx, nz, 2.2);
      u.x = fixed.x; u.z = fixed.z;
      u.mesh.position.set(u.x, city.onBridge(u.x, u.z) ? city.bridgeHeight(u.x) : 0, u.z);
      u.mesh.rotation.y = u.heading;
      for (const w of u.mesh.userData.wheels) w.rotation.x += u.speed * dt * 2;
      u.dist = d;
    }
    if (this.heli) {
      this.spotAngle += dt * 0.55;
      const hx = playerPos.x + Math.cos(this.spotAngle) * 42;
      const hz = playerPos.z + Math.sin(this.spotAngle) * 42;
      this.heli.position.set(hx, 24, hz);
      this.heli.rotation.y = Math.atan2(playerPos.x - hx, playerPos.z - hz);
      if (this.heliRotor) this.heliRotor.rotation.y += dt * 22;
      if (this.heliLight) this.heliLight.intensity = 1.8 + Math.sin(now * 6) * 0.5;
    }
  }

  dispatchList() {
    return this.units.map((u) => ({
      name: u.callsign,
      dist: Math.round(u.dist ?? 0),
      status: u.swat ? 'SWAT ' + u.tactic : u.tactic,
    }));
  }

  clear() {
    this.wanted = 0; this.heat = 0;
    for (const u of this.units) this.scene.remove(u.mesh);
    this.units = [];
    if (this.heli) { this.scene.remove(this.heli); this.heli = null; }
  }
}
