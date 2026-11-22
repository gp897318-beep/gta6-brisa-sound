// BRISA SOUND — city.js: builds the whole city — roads, districts, buildings.
// Dusk-purple coastal city: downtown towers, neon signs, palm-lined avenues,
// a beach and ocean on the east, a marina, and the elevated Coral Span bridge
// crossing the harbor channel. All low-poly Three.js.
import '../vendor/three.min.js';
const THREE = window.THREE;
import { mulberry32, pick, range, intRange } from './random.js';

export const ROADS_X = [-180, -120, -60, 0, 60, 120];
export const ROADS_Z = [-180, -120, -60, 0, 60, 120, 180];
export const CITY_BOUND = 235;
export const CHANNEL = { x0: 168, x1: 212 }; // harbor channel, bridged at z = 0
export const DISTRICTS = [
  { name: 'DOWNTOWN BRISA', x: -30, z: -30, r: 110 },
  { name: 'CORAL SPAN', x: 190, z: 0, r: 60 },
  { name: 'MARINA DEL SOL', x: 250, z: 60, r: 70 },
  { name: 'PALM ROW', x: -60, z: 150, r: 90 },
  { name: 'NEON MILE', x: 60, z: -120, r: 80 },
  { name: 'SANDPIPER BEACH', x: 250, z: -120, r: 80 },
];

export function districtAt(x, z) {
  let best = DISTRICTS[0], bd = 1e9;
  for (const d of DISTRICTS) {
    const dd = (x - d.x) * (x - d.x) + (z - d.z) * (z - d.z);
    if (dd < bd) { bd = dd; best = d; }
  }
  return best.name;
}

export function streetName(x, z) {
  const nx = Math.round(x / 60), nz = Math.round(z / 60);
  const avenues = ['CORAL AVE', 'NEON BLVD', 'PALM ROW', 'HARBOUR RD', 'DUSK ST', 'MARINA WAY', 'SPAN DR'];
  const streets = ['BRISA ST', 'TIDE ST', 'LUMEN ST', 'CORAL ST', 'VIOLET ST', 'ANCHOR ST', 'GULL ST'];
  if (Math.abs(x - ROADS_X.reduce((a, b) => Math.abs(b - x) < Math.abs(a - x) ? b : a)) < 8) {
    return avenues[((nx % avenues.length) + avenues.length) % avenues.length];
  }
  return streets[((nz % streets.length) + streets.length) % streets.length];
}

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  return t;
}

function buildingTexture(rng, base, litRatio) {
  return canvasTexture(128, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let y = 10; y < h - 10; y += 18) {
      for (let x = 8; x < w - 8; x += 16) {
        const lit = rng() < litRatio;
        g.fillStyle = lit ? (rng() < 0.5 ? '#ffd27a' : '#9fe8ff') : '#1a2030';
        g.fillRect(x, y, 10, 12);
      }
    }
  });
}

function neonTexture(text, color) {
  return canvasTexture(256, 64, (g, w, h) => {
    g.fillStyle = '#0b0b18'; g.fillRect(0, 0, w, h);
    g.font = 'bold 34px sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = color; g.shadowBlur = 18;
    g.fillStyle = color;
    g.fillText(text, w / 2, h / 2);
    g.shadowBlur = 0;
    g.fillStyle = '#ffffff';
    g.fillText(text, w / 2, h / 2);
  });
}

export class City {
  constructor(scene, seed) {
    this.scene = scene;
    this.rng = mulberry32(seed);
    this.colliders = []; // {x, z, r} building footprints for simple collision
    this.palms = [];
    this.neonSigns = ['BRISA', 'NEON MILE', 'TÍA ROSA', 'MARINA', 'DUSK CLUB', 'CORAL', 'PALM HOTEL', 'LUMEN'];
    this.build();
  }

  build() {
    const rng = this.rng;
    const scene = this.scene;

    // Dusk sky: gradient dome (deep purple zenith to orange-pink horizon) + fog.
    const skyTex = canvasTexture(4, 256, (g, w, h) => {
      const grad = g.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#2a1145');
      grad.addColorStop(0.45, '#7a3d8f');
      grad.addColorStop(0.75, '#e86a7a');
      grad.addColorStop(1, '#ffb36b');
      g.fillStyle = grad;
      g.fillRect(0, 0, w, h);
    });
    const skyGeo = new THREE.SphereGeometry(900, 16, 12);
    const skyMat = new THREE.MeshBasicMaterial({
      map: skyTex, side: THREE.BackSide, fog: false,
    });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    scene.add(sky);
    // Sun disc low on the horizon (west).
    const sun = new THREE.Mesh(
      new THREE.CircleGeometry(60, 32),
      new THREE.MeshBasicMaterial({ color: 0xff9a4d, fog: false }),
    );
    sun.position.set(-700, 90, -250);
    sun.lookAt(0, 60, 0);
    scene.add(sun);
    scene.fog = new THREE.Fog(0x6b3a72, 180, 700);

    // Lighting: warm dusk sun + purple ambient + hemisphere.
    const hemi = new THREE.HemisphereLight(0xb678c9, 0x2a1a33, 0.75);
    scene.add(hemi);
    this.hemi = hemi;
    const dir = new THREE.DirectionalLight(0xffb36b, 1.0);
    dir.position.set(-180, 140, 80);
    scene.add(dir);
    this.dirLight = dir;
    const amb = new THREE.AmbientLight(0x604a7a, 0.5);
    scene.add(amb);
    this.skyMat = skyMat;
    this.rainOn = false;

    // Rain: a sheet of falling streaks that follows the player.
    const rainCount = 700;
    const rainPos = new Float32Array(rainCount * 3);
    for (let i = 0; i < rainCount; i++) {
      rainPos[i * 3] = (rng() - 0.5) * 130;
      rainPos[i * 3 + 1] = rng() * 55;
      rainPos[i * 3 + 2] = (rng() - 0.5) * 130;
    }
    const rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
    this.rain = new THREE.Points(rainGeo, new THREE.PointsMaterial({
      color: 0x9fc8ff, size: 0.4, transparent: true, opacity: 0.65,
    }));
    this.rain.visible = false;
    scene.add(this.rain);

    // Ground base.
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(1200, 1200),
      new THREE.MeshLambertMaterial({ color: 0x3a3348 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    scene.add(ground);

    // Ocean (east of the channel) + beach sand strip.
    const ocean = new THREE.Mesh(
      new THREE.PlaneGeometry(400, 700),
      new THREE.MeshLambertMaterial({ color: 0x274b7a }),
    );
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.set(430, 0.05, 0);
    scene.add(ocean);
    const beach = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 700),
      new THREE.MeshLambertMaterial({ color: 0xc9a06a }),
    );
    beach.rotation.x = -Math.PI / 2;
    beach.position.set(240, 0.06, 0);
    scene.add(beach);
    // Harbor channel water (the bridge crosses it).
    const channel = new THREE.Mesh(
      new THREE.PlaneGeometry(CHANNEL.x1 - CHANNEL.x0, 560),
      new THREE.MeshLambertMaterial({ color: 0x2c527e }),
    );
    channel.rotation.x = -Math.PI / 2;
    channel.position.set((CHANNEL.x0 + CHANNEL.x1) / 2, 0.07, 0);
    scene.add(channel);

    // Roads: dark strips + center dashes.
    const roadMat = new THREE.MeshLambertMaterial({ color: 0x23202e });
    const dashMat = new THREE.MeshBasicMaterial({ color: 0xd8c25a });
    for (const x of ROADS_X) {
      const r = new THREE.Mesh(new THREE.PlaneGeometry(13, 520), roadMat);
      r.rotation.x = -Math.PI / 2; r.position.set(x, 0.1, 0);
      scene.add(r);
      for (let z = -240; z <= 240; z += 16) {
        if (Math.abs(z) < 10) continue; // bridge crossing keeps its own deck
        const d = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 6), dashMat);
        d.rotation.x = -Math.PI / 2; d.position.set(x, 0.12, z);
        scene.add(d);
      }
    }
    for (const z of ROADS_Z) {
      const r = new THREE.Mesh(new THREE.PlaneGeometry(520, 13), roadMat);
      r.rotation.x = -Math.PI / 2; r.position.set(0, 0.1, z);
      scene.add(r);
      for (let x = -240; x <= 240; x += 16) {
        if (x > CHANNEL.x0 - 8 && x < CHANNEL.x1 + 8 && Math.abs(z) < 10) continue;
        const d = new THREE.Mesh(new THREE.PlaneGeometry(6, 0.7), dashMat);
        d.rotation.x = -Math.PI / 2; d.position.set(x, 0.12, z);
        scene.add(d);
      }
    }

    // Coral Span bridge: an arched deck of segments following the sine
    // profile cars drive on (see bridgeHeight), so the road rises gently
    // over the channel instead of hitting a wall. Pylons stand at the
    // deck's sides, never in the middle of the road.
    const deckMat = new THREE.MeshLambertMaterial({ color: 0x2e2a3a });
    for (let i = 0; i < 10; i++) {
      const x0 = 148 + i * 8.4;
      const mid = x0 + 4.2;
      const y = this.bridgeHeight(mid);
      const next = this.bridgeHeight(Math.min(mid + 4.2, 230));
      const prev = this.bridgeHeight(Math.max(mid - 4.2, 150));
      const seg = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.9, 16), deckMat);
      seg.position.set(mid, y - 0.45, 0);
      seg.rotation.z = -Math.atan2(next - prev, 8.4);
      scene.add(seg);
    }
    const pylonMat = new THREE.MeshLambertMaterial({ color: 0x8f7fb0 });
    for (const px of [176, 204]) {
      for (const pz of [-9, 9]) {
        const p = new THREE.Mesh(new THREE.BoxGeometry(2.5, 34, 2.5), pylonMat);
        p.position.set(px, 17, pz);
        scene.add(p);
      }
    }
    const cableMat = new THREE.MeshBasicMaterial({ color: 0xffd27a });
    for (let i = 0; i < 7; i++) {
      const t = i / 6;
      const cx = 176 + t * 28;
      const cable = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1, 0.25), cableMat);
      cable.position.set(cx, 20 - Math.abs(t - 0.5) * 14, 0);
      cable.scale.y = 14;
      scene.add(cable);
    }
    // Neon strip along the bridge.
    const bridgeNeon = new THREE.Mesh(
      new THREE.BoxGeometry(88, 0.5, 0.5),
      new THREE.MeshBasicMaterial({ color: 0xff4dd2 }),
    );
    bridgeNeon.position.set(190, 8.2, 8.2);
    scene.add(bridgeNeon);

    // Buildings: block CENTERS between roads (roads at multiples of 60, so
    // centers sit at ...-150, -90, -30, 30, 90, 150...), never on a road.
    const palette = ['#4a4468', '#5d4a72', '#3d4a6b', '#6b4a5e', '#46586e', '#54406a'];
    const winTex = [];
    for (let i = 0; i < 4; i++) winTex.push(buildingTexture(rng, palette[i % palette.length], 0.45));
    let signIdx = 0;
    for (let bx = -180; bx <= 120; bx += 60) {
      for (let bz = -180; bz <= 180; bz += 60) {
        if (rng() < 0.18) continue; // empty lots / plazas
        const cx = bx + 30, cz = bz + 30;
        if (cx > CHANNEL.x0 - 40) continue;
        const downtown = Math.abs(cx) < 90 && Math.abs(cz) < 90;
        const h = downtown ? range(rng, 45, 110) : range(rng, 12, 42);
        const w = range(rng, 18, 30), d = range(rng, 18, 30);
        const tex = winTex[intRange(rng, 0, 3)];
        const mat = new THREE.MeshLambertMaterial({ map: tex, emissive: 0x332244, emissiveMap: tex });
        const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        b.position.set(cx + range(rng, -4, 4), h / 2, cz + range(rng, -4, 4));
        scene.add(b);
        this.colliders.push({ x: b.position.x, z: b.position.z, r: Math.max(w, d) * 0.62 });
        // Rooftop beacon.
        if (h > 60) {
          const beacon = new THREE.Mesh(
            new THREE.SphereGeometry(0.9, 8, 8),
            new THREE.MeshBasicMaterial({ color: 0xff3344 }),
          );
          beacon.position.set(b.position.x, h + 1, b.position.z);
          scene.add(beacon);
        }
        // Neon sign on the facade.
        if (rng() < 0.45) {
          const label = this.neonSigns[signIdx++ % this.neonSigns.length];
          const color = pick(rng, ['#ff4dd2', '#39d5ff', '#ffd23f', '#7dff6a']);
          const sign = new THREE.Mesh(
            new THREE.PlaneGeometry(16, 4),
            new THREE.MeshBasicMaterial({ map: neonTexture(label, color) }),
          );
          sign.position.set(b.position.x, Math.min(h - 3, 26), b.position.z + d / 2 + 0.3);
          scene.add(sign);
        }
      }
    }

    // Marina: docks + boats east of the beach.
    const dockMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2f });
    for (let i = 0; i < 4; i++) {
      const dock = new THREE.Mesh(new THREE.BoxGeometry(26, 1, 4), dockMat);
      dock.position.set(300, 0.8, -90 + i * 60);
      scene.add(dock);
      const boat = new THREE.Group();
      const hull = new THREE.Mesh(
        new THREE.BoxGeometry(10, 2, 3.4),
        new THREE.MeshLambertMaterial({ color: pick(rng, [0xe8e8e8, 0xffd27a, 0x7ad0ff]) }),
      );
      hull.position.y = 1;
      boat.add(hull);
      const mast = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.15, 7, 6),
        new THREE.MeshLambertMaterial({ color: 0x888888 }),
      );
      mast.position.y = 5;
      boat.add(mast);
      boat.position.set(308 + rng() * 10, 0, -90 + i * 60 + range(rng, -6, 6));
      scene.add(boat);
    }

    // Palm trees along avenues + beach.
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5a38 });
    const leafMat = new THREE.MeshLambertMaterial({ color: 0x2f8f4e });
    const palmSpots = [];
    // Avenue palms sit on the sidewalk corner (offset in BOTH axes) so no
    // palm ever stands in the middle of a road.
    for (const x of ROADS_X) for (let z = -210; z <= 210; z += 42) palmSpots.push([x + 9, z + 9]);
    for (let z = -210; z <= 210; z += 30) palmSpots.push([228, z]);
    for (const [px, pz] of palmSpots) {
      if (rng() < 0.35) continue;
      if (px > CHANNEL.x0 - 12 && px < CHANNEL.x1 + 12) continue;
      const palm = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, 7, 6), trunkMat);
      trunk.position.y = 3.5;
      trunk.rotation.z = range(rng, -0.08, 0.08);
      palm.add(trunk);
      for (let i = 0; i < 6; i++) {
        const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.9, 4.5, 4), leafMat);
        const a = (i / 6) * Math.PI * 2;
        leaf.position.set(Math.cos(a) * 1.6, 7.2, Math.sin(a) * 1.6);
        leaf.rotation.z = Math.cos(a) * 1.1;
        leaf.rotation.x = -Math.sin(a) * 1.1;
        palm.add(leaf);
      }
      palm.position.set(px, 0, pz);
      scene.add(palm);
      this.palms.push(palm);
    }

    // Streetlights with warm glow — set on the sidewalk corner (offset in
    // BOTH axes) so a pole never stands in the middle of a road.
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x333344 });
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });
    for (const x of ROADS_X) {
      for (let z = -180; z <= 180; z += 60) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 8, 6), poleMat);
        pole.position.set(x - 8, 4, z + 8);
        scene.add(pole);
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 8), lampMat);
        lamp.position.set(x - 8, 8.2, z + 8);
        scene.add(lamp);
      }
    }

    // Distant skyline silhouettes.
    const skyMat2 = new THREE.MeshBasicMaterial({ color: 0x4a2a5e, fog: false });
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2;
      const r = 520 + rng() * 120;
      const h = 60 + rng() * 130;
      const sil = new THREE.Mesh(new THREE.BoxGeometry(30, h, 30), skyMat2);
      sil.position.set(Math.cos(a) * r, h / 2 - 4, Math.sin(a) * r);
      scene.add(sil);
    }
  }

  // Day/night cycle: hours 0-24. Dusk (17-20) is warm purple, night is dark
  // blue, midday is bright. Tints the sky, lights and fog together.
  setTimeOfDay(hours) {
    const h = ((hours % 24) + 24) % 24;
    let day;
    if (h >= 6 && h < 17) day = 1;
    else if (h >= 17 && h < 21) day = 1 - ((h - 17) / 4) * 0.75;
    else if (h >= 5 && h < 6) day = 0.25 + (h - 5) * 0.75;
    else day = 0.25;
    this.hemi.intensity = 0.35 + 0.55 * day;
    this.dirLight.intensity = 0.25 + 0.85 * day;
    this.dirLight.color.setHex(day < 0.55 ? 0xffb36b : 0xfff2d8);
    const c = new THREE.Color();
    if (day > 0.9) c.setHex(0xffffff);
    else if (day > 0.4) c.setHex(0xffffff).lerp(new THREE.Color(0x8a5aa0), (0.9 - day) * 1.2);
    else c.setHex(0x4a5680);
    this.skyMat.color.copy(c);
    const fogC = new THREE.Color(0x6b3a72);
    if (day > 0.9) fogC.setHex(0x87a8c9);
    else if (day <= 0.4) fogC.setHex(0x10142e);
    this.scene.fog.color.copy(fogC);
    return day;
  }

  setRain(on) {
    this.rainOn = on;
    this.rain.visible = on;
    if (this.scene.fog) {
      this.scene.fog.near = on ? 60 : 180;
      this.scene.fog.far = on ? 420 : 700;
    }
  }

  updateRain(dt, cx, cz) {
    if (!this.rainOn) return;
    this.rain.position.set(cx, 0, cz);
    const pos = this.rain.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let y = pos.getY(i) - 42 * dt;
      if (y < 0) y = 55;
      pos.setY(i, y);
    }
    pos.needsUpdate = true;
  }

  // Simple circle-vs-building collision. Returns corrected position.
  collide(x, z, r) {
    for (const c of this.colliders) {
      const dx = x - c.x, dz = z - c.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      const min = c.r + r;
      if (d < min && d > 0.001) {
        x = c.x + (dx / d) * min;
        z = c.z + (dz / d) * min;
      }
    }
    x = Math.max(-CITY_BOUND, Math.min(CITY_BOUND + 90, x));
    z = Math.max(-CITY_BOUND, Math.min(CITY_BOUND, z));
    return { x, z };
  }

  onBridge(x, z) {
    return x > 150 && x < 230 && Math.abs(z) < 8;
  }

  bridgeHeight(x) {
    if (x <= 150 || x >= 230) return 0;
    const t = (x - 150) / 80;
    return Math.sin(t * Math.PI) * 7;
  }
}
