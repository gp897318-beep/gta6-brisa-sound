// BRISA SOUND — peds.js: pedestrians on the sidewalks of the city.
// Sidewalk walkers who stroll, chat, and flee when a car speeds at them
// or a shot rings out.
import '../vendor/three.min.js';
const THREE = window.THREE;
import { mulberry32, pick, range, clamp } from './random.js';
import { ROADS_X, ROADS_Z } from './city.js';

const SHIRTS = [0xff6b6b, 0x4ecdc4, 0xffe66d, 0x95e1d3, 0xf38181, 0xaa96da, 0xfcbad3, 0xa8e6cf];
const PANTS = [0x2b2d42, 0x3d405b, 0x5a5a6e, 0x1d3557];

export class Peds {
  constructor(scene, seed, count = 22) {
    this.scene = scene;
    this.rng = mulberry32(seed ^ 0xbeef);
    this.list = [];
    for (let i = 0; i < count; i++) this.list.push(this.spawn());
  }

  spawn() {
    const rng = this.rng;
    const g = new THREE.Group();
    const shirt = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.8, 0.4),
      new THREE.MeshLambertMaterial({ color: pick(rng, SHIRTS) }),
    );
    shirt.position.y = 1.15;
    g.add(shirt);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.26, 10, 8),
      new THREE.MeshLambertMaterial({ color: pick(rng, [0xf1c27d, 0xe0ac69, 0x8d5524, 0xffdbac]) }),
    );
    head.position.y = 1.75;
    g.add(head);
    const legs = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.8, 0.35),
      new THREE.MeshLambertMaterial({ color: pick(rng, PANTS) }),
    );
    legs.position.y = 0.4;
    g.add(legs);
    // Walk on a sidewalk beside a random road.
    const axis = rng() < 0.5 ? 'x' : 'z';
    const road = axis === 'x' ? pick(rng, ROADS_X) : pick(rng, ROADS_Z);
    const along = range(rng, -210, 210);
    const ped = {
      mesh: g, axis, road, along,
      dir: rng() < 0.5 ? 1 : -1,
      speed: range(rng, 1.2, 2.4),
      flee: 0,
      bob: rng() * Math.PI * 2,
    };
    g.position.set(
      axis === 'x' ? along : road + 8.5,
      0,
      axis === 'z' ? along : road + 8.5,
    );
    this.scene.add(g);
    return ped;
  }

  update(dt, playerPos, playerSpeed, threat) {
    for (const p of this.list) {
      const px = p.axis === 'x' ? p.along : p.road + 8.5;
      const pz = p.axis === 'z' ? p.along : p.road + 8.5;
      const d = Math.hypot(px - playerPos.x, pz - playerPos.z);
      if (d < 10 && (Math.abs(playerSpeed) > 8 || threat)) p.flee = 2.5;
      if (p.flee > 0) {
        p.flee -= dt;
        // Run away from the player, off the sidewalk.
        const a = Math.atan2(pz - playerPos.z, px - playerPos.x);
        const nx = px + Math.cos(a) * 5 * dt;
        const nz = pz + Math.sin(a) * 5 * dt;
        p.mesh.position.set(nx, 0, nz);
        p.mesh.rotation.y = Math.atan2(Math.cos(a), Math.sin(a));
        p.along += 0; // fleeing overrides the walk path; re-anchor below
        p.road = p.axis === 'x' ? nz - 8.5 : nx - 8.5;
        p.along = p.axis === 'x' ? nx : nz;
        continue;
      }
      p.along += p.dir * p.speed * dt;
      if (p.along > 220 || p.along < -220) p.dir *= -1;
      p.bob += dt * 6;
      const x = p.axis === 'x' ? p.along : p.road + 8.5;
      const z = p.axis === 'z' ? p.along : p.road + 8.5;
      p.mesh.position.set(x, Math.abs(Math.sin(p.bob)) * 0.06, z);
      p.mesh.rotation.y = p.axis === 'x' ? (p.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (p.dir > 0 ? 0 : Math.PI);
    }
  }

  nearest(x, z, maxDist) {
    let best = null, bd = maxDist;
    for (const p of this.list) {
      const d = Math.hypot(p.mesh.position.x - x, p.mesh.position.z - z);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }
}
