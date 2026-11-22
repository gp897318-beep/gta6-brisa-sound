// BRISA SOUND — cars.js: player car physics, NPC traffic, police cruisers.
// Vehicles for Brisa Sound: all cars are low-poly boxes + cylinders; physics
// is arcade (accel/brake/steer).
import '../vendor/three.min.js';
const THREE = window.THREE;
import { mulberry32, pick, range, clamp, angleLerp } from './random.js';
import { ROADS_X, ROADS_Z } from './city.js';

export const CAR_MODELS = [
  { name: 'CALYX SPRINT GT', color: 0xff2e63, topSpeed: 46, accel: 26, grip: 2.6 },
  { name: 'VULPE SEDAN', color: 0x2e86ff, topSpeed: 34, accel: 18, grip: 2.2 },
  { name: 'MARLOW TAXI', color: 0xffc93f, topSpeed: 32, accel: 17, grip: 2.1 },
  { name: 'OSTRA VAN', color: 0x8a93a6, topSpeed: 28, accel: 14, grip: 1.9 },
  { name: 'LUMEN COUPE', color: 0x39d5ff, topSpeed: 40, accel: 22, grip: 2.4 },
  { name: 'BRISA PICKUP', color: 0x7dff6a, topSpeed: 30, accel: 16, grip: 2.0 },
];

export function buildCarMesh(model, isPolice = false) {
  const g = new THREE.Group();
  const bodyColor = isPolice ? 0x11131c : model.color;
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(2.1, 0.65, 4.4),
    new THREE.MeshLambertMaterial({ color: bodyColor }),
  );
  body.position.y = 0.55;
  g.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.55, 2.1),
    new THREE.MeshLambertMaterial({ color: isPolice ? 0x222633 : 0x1c2233 }),
  );
  cabin.position.set(0, 1.1, -0.25);
  g.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x0c0c10 });
  const wheels = [];
  for (const [wx, wz] of [[-1.0, 1.45], [1.0, 1.45], [-1.0, -1.45], [1.0, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.38, wz);
    g.add(w);
    wheels.push(w);
  }
  if (isPolice) {
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.18, 0.4),
      new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xffffff }),
    );
    bar.position.set(0, 1.5, -0.25);
    g.add(bar);
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(2.12, 0.2, 4.42),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    );
    stripe.position.y = 0.62;
    g.add(stripe);
  } else {
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
    for (const sx of [-0.7, 0.7]) {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), lightMat);
      hl.position.set(sx, 0.6, 2.22);
      g.add(hl);
    }
  }
  g.userData.wheels = wheels;
  return g;
}

export class Car {
  constructor(mesh, model) {
    this.mesh = mesh;
    this.model = model;
    this.x = 0; this.z = 0; this.y = 0;
    this.heading = 0;
    this.speed = 0;
    this.condition = 100;
    this.spin = 0;
  }

  get pos() { return { x: this.x, z: this.z }; }

  update(dt, input, city, onCrash) {
    const axes = input.driveAxes();
    const top = this.model.topSpeed;
    if (axes.fwd > 0) this.speed += this.model.accel * dt;
    else if (axes.fwd < 0) this.speed -= this.model.accel * 1.1 * dt;
    else this.speed *= Math.max(0, 1 - 0.9 * dt);
    if (input.isDown('Space')) this.speed *= Math.max(0, 1 - 3.2 * dt);
    this.speed = clamp(this.speed, -12, top);
    const steerRate = this.model.grip * clamp(Math.abs(this.speed) / 12, 0.25, 1);
    this.heading += axes.steer * steerRate * dt * (this.speed >= 0 ? 1 : -1) * (this.speed > 0.5 || this.speed < -0.5 ? 1 : 0);
    const nx = this.x + Math.sin(this.heading) * this.speed * dt;
    const nz = this.z + Math.cos(this.heading) * this.speed * dt;
    const before = { x: this.x, z: this.z };
    const fixed = city.collide(nx, nz, 2.2);
    const hitWall = Math.abs(fixed.x - nx) > 0.01 || Math.abs(fixed.z - nz) > 0.01;
    if (hitWall && Math.abs(this.speed) > 6) {
      if (onCrash) onCrash(Math.abs(this.speed));
      this.speed *= 0.35;
      this.condition = Math.max(0, this.condition - Math.abs(this.speed) * 0.4);
    }
    this.x = fixed.x; this.z = fixed.z;
    this.y = city.onBridge(this.x, this.z) ? city.bridgeHeight(this.x) : 0;
    const moved = Math.hypot(this.x - before.x, this.z - before.z);
    if (moved < 0.001 && Math.abs(this.speed) > 4) this.speed *= 0.5;
    this.mesh.position.set(this.x, this.y, this.z);
    this.mesh.rotation.y = this.heading;
    const roll = -axes.steer * clamp(Math.abs(this.speed) / top, 0, 1) * 0.06;
    this.mesh.rotation.z = roll;
    for (const w of this.mesh.userData.wheels) w.rotation.x += this.speed * dt * 2.2;
  }
}

export class Traffic {
  constructor(scene, city, seed, count = 16) {
    this.scene = scene;
    this.city = city;
    this.rng = mulberry32(seed ^ 0x9e37);
    this.cars = [];
    for (let i = 0; i < count; i++) {
      const model = pick(this.rng, CAR_MODELS);
      const mesh = buildCarMesh(model);
      scene.add(mesh);
      const axis = this.rng() < 0.5 ? 'x' : 'z';
      // axis 'x': drives along X on an east-west road (z = road + lane).
      // axis 'z': drives along Z on a north-south road (x = road + lane).
      const road = axis === 'x' ? pick(this.rng, ROADS_Z) : pick(this.rng, ROADS_X);
      const along = range(this.rng, -210, 210);
      const car = {
        mesh, model,
        axis, road, along,
        dir: this.rng() < 0.5 ? 1 : -1,
        speed: range(this.rng, 8, 15),
        lane: this.rng() < 0.5 ? -3.2 : 3.2,
        wait: 0,
      };
      this.cars.push(car);
    }
  }

  update(dt, playerPos) {
    for (const c of this.cars) {
      if (c.wait > 0) { c.wait -= dt; continue; }
      // Slow down if the player car is right ahead.
      const dx = playerPos.x - (c.axis === 'x' ? c.along : c.road + c.lane);
      const dz = playerPos.z - (c.axis === 'z' ? c.along : c.road + c.lane);
      const nearPlayer = Math.hypot(dx, dz) < 9;
      const speed = nearPlayer ? c.speed * 0.25 : c.speed;
      c.along += c.dir * speed * dt;
      if (c.along > 225) { c.along = -225; }
      if (c.along < -225) { c.along = 225; }
      // Random turn at intersections: crossing roads are the perpendicular set.
      const crossRoads = c.axis === 'x' ? ROADS_X : ROADS_Z;
      const cross = crossRoads.find((r) => Math.abs(c.along - r) < 1.2);
      if (cross !== undefined && this.rng() < dt * 0.25) {
        const oldPerp = c.road + c.lane; // position along the new axis
        c.axis = c.axis === 'x' ? 'z' : 'x';
        c.road = cross;
        c.along = oldPerp;
        c.dir = this.rng() < 0.5 ? 1 : -1;
        c.wait = 0.4;
      }
      const x = c.axis === 'x' ? c.along : c.road + c.lane;
      const z = c.axis === 'z' ? c.along : c.road + c.lane;
      c.mesh.position.set(x, this.city.onBridge(x, z) ? this.city.bridgeHeight(x) : 0, z);
      let targetHeading = 0;
      if (c.axis === 'x') targetHeading = c.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      else targetHeading = c.dir > 0 ? 0 : Math.PI;
      c.mesh.rotation.y = angleLerp(c.mesh.rotation.y, targetHeading, Math.min(1, dt * 6));
      for (const w of c.mesh.userData.wheels) w.rotation.x += speed * dt * 2;
    }
  }

  nearest(x, z, maxDist = 14) {
    let best = null, bd = maxDist;
    for (const c of this.cars) {
      const cx = c.axis === 'x' ? c.along : c.road + c.lane;
      const cz = c.axis === 'z' ? c.along : c.road + c.lane;
      const d = Math.hypot(cx - x, cz - z);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }
}
