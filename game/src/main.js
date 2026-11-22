// BRISA SOUND — main.js: boot, game loop, player, camera, combat, save.
// A 3D third-person open-world crime game: on foot and by car, traffic,
// pedestrians, police wanted levels, 7 story missions, HUD + minimap.
// Entry point — wires city, cars, police, peds, missions, side jobs and HUD.
import '../vendor/three.min.js';
const THREE = window.THREE;
import { mulberry32, hashSeed, clamp, dist2D, angleLerp } from './random.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { City } from './city.js';
import { Car, Traffic, buildCarMesh, CAR_MODELS } from './cars.js';
import { Police } from './police.js';
import { Peds } from './peds.js';
import { MissionManager, CREW, FIXER } from './missions.js';
import { SideActivities } from './side.js';
import { HUD } from './hud.js';
import { stageShot, paintShot } from './shots.js';

const SAVE_KEY = 'brisa-sound-save-v1';

export class Game {
  constructor() {
    const params = new URLSearchParams(location.search);
    this.seed = parseInt(params.get('seed') || '1', 10) || 1;
    this.shotMode = params.get('shot');
    this.rng = mulberry32(hashSeed('brisa-sound-' + this.seed));
    this.input = new Input();
    this.audio = new AudioEngine();
    this.state = {
      playing: false,
      time: 0,
      gameMinutes: 19 * 60 + 42,
      money: 1250,
      respect: 24,
      health: 100,
      armor: 60,
      wantedOverride: 0,
      inCar: false,
      speedKmh: 0,
      autopilot: false,
      storyDone: false,
    };
    this.missions = new MissionManager();
    this.side = new SideActivities(this.scene);
    this.crew = CREW.map((c) => ({ ...c }));
    this.dialogTimer = 0;
    this.dialogQueue = [];
    this.shotFrames = 0;
    this.garage = { engine: 1, armor: 1, nitro: 0 };
    this.nitroFuel = 100;
    this.standing = {
      'DOWNTOWN BRISA': 20, 'CORAL SPAN': 15, 'MARINA DEL SOL': 25,
      'PALM ROW': 30, 'NEON MILE': 35, 'SANDPIPER BEACH': 10,
    };
    this.rainTimer = 70 + Math.random() * 50;
    this.rainOn = false;
    this.wrecks = [];

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    document.getElementById('app').appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 2000);

    this.city = new City(this.scene, this.seed);
    this.traffic = new Traffic(this.scene, this.city, this.seed, 16);
    this.police = new Police(this.scene, this.seed);
    this.peds = new Peds(this.scene, this.seed, 22);
    this.hud = new HUD();

    // Player on foot.
    this.player = this.buildPlayerMesh();
    this.scene.add(this.player);
    this.playerPos = { x: 0, z: 30 };
    this.playerHeading = Math.PI;
    this.playerSpeed = 0;
    this.playerCar = null; // Car instance when driving
    this.parkedCars = [];
    this.weaponAmmo = { pistol: 48, smg: 120, shotgun: 24, rifle: 60 };
    this.weaponIndex = 1;
    this.shotCooldown = 0;

    // Objective beacon: glowing pillar + floating marker at the target.
    this.beacon = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 1.6, 60, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.22, side: THREE.DoubleSide }),
    );
    this.scene.add(this.beacon);
    this.marker = new THREE.Mesh(
      new THREE.ConeGeometry(1.4, 2.6, 8),
      new THREE.MeshBasicMaterial({ color: 0xffd23f }),
    );
    this.scene.add(this.marker);

    // Park a starter Calyx Sprint GT near the spawn.
    this.spawnParkedCar(CAR_MODELS[0], 6, 26, Math.PI / 2);

    this.loadSave();
    this.bindMenu();
    this.bindKeys();
    addEventListener('resize', () => this.onResize());

    if (this.shotMode) {
      stageShot(this, this.shotMode);
      this.state.playing = this.shotMode !== 'menu';
    } else {
      this.showMenu();
      this.placeCameraForMenu();
    }
    window.__brisa = this;
    this.last = performance.now();
    const loop = (t) => {
      const dt = clamp((t - this.last) / 1000, 0, 0.05);
      this.last = t;
      this.tick(dt);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  buildPlayerMesh() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 1.0, 0.45),
      new THREE.MeshLambertMaterial({ color: 0xff2e63 }),
    );
    body.position.y = 1.0;
    g.add(body);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 12, 10),
      new THREE.MeshLambertMaterial({ color: 0xf1c27d }),
    );
    head.position.y = 1.75;
    g.add(head);
    const legs = new THREE.Mesh(
      new THREE.BoxGeometry(0.65, 0.7, 0.4),
      new THREE.MeshLambertMaterial({ color: 0x2b2d42 }),
    );
    legs.position.y = 0.35;
    g.add(legs);
    return g;
  }

  spawnParkedCar(model, x, z, heading) {
    const mesh = buildCarMesh(model);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = heading;
    this.scene.add(mesh);
    const car = { mesh, model, x, z, heading, parked: true };
    this.parkedCars.push(car);
    return car;
  }

  spawnPlayerCarAt(x, z, heading, model) {
    if (this.playerCar) this.scene.remove(this.playerCar.mesh);
    const mesh = buildCarMesh(model);
    this.scene.add(mesh);
    const car = new Car(mesh, model);
    car.x = x; car.z = z; car.heading = heading;
    car.mesh.position.set(x, 0, z);
    car.mesh.rotation.y = heading;
    this.playerCar = car;
    this.state.inCar = true;
    this.playerPos = { x, z };
    this.playerHeading = heading;
    this.player.visible = false;
    return car;
  }

  spawnPlayerOnFoot(x, z, heading) {
    if (this.playerCar) {
      this.scene.remove(this.playerCar.mesh);
      this.playerCar = null;
    }
    this.state.inCar = false;
    this.playerPos = { x, z };
    this.playerHeading = heading;
    this.player.visible = true;
    this.player.position.set(x, 0, z);
    this.player.rotation.y = heading;
  }

  bindMenu() {
    const $ = (id) => document.getElementById(id);
    $('btn-start')?.addEventListener('click', () => { this.audio.ensure(); this.startGame(false); });
    $('btn-continue')?.addEventListener('click', () => { this.audio.ensure(); this.startGame(true); });
    $('btn-garage')?.addEventListener('click', () => { this.audio.ensure(); this.openGarage(); });
    $('btn-how')?.addEventListener('click', () => {
      $('howto').classList.toggle('visible');
    });
    $('btn-mute')?.addEventListener('click', () => {
      this.audio.muted = !this.audio.muted;
      $('btn-mute').textContent = this.audio.muted ? 'SOUND: OFF' : 'SOUND: ON';
    });
    $('buy-engine')?.addEventListener('click', () => this.buyUpgrade('engine'));
    $('buy-armor')?.addEventListener('click', () => this.buyUpgrade('armor'));
    $('buy-nitro')?.addEventListener('click', () => this.buyUpgrade('nitro'));
    $('garage-close')?.addEventListener('click', () => this.closeGarage());
  }

  garageCost(id) {
    if (id === 'engine') return 500 * this.garage.engine;
    if (id === 'armor') return 400 * this.garage.armor;
    return 800 * (this.garage.nitro + 1);
  }

  buyUpgrade(id) {
    const cost = this.garageCost(id);
    if (this.state.money < cost) {
      this.hud.toast(`NOT ENOUGH CASH — ${id.toUpperCase()} COSTS $${cost}`);
      return;
    }
    this.state.money -= cost;
    this.garage[id]++;
    if (id === 'engine' && this.playerCar) {
      this.playerCar.model = { ...this.playerCar.model, topSpeed: this.playerCar.model.topSpeed * 1.12 };
    }
    this.audio.blip(1320, 0.15, 0.15);
    this.hud.toast(`${id.toUpperCase()} UPGRADED TO LV${this.garage[id]} — $${cost}`);
    this.refreshGarage();
    this.saveGame();
  }

  refreshGarage() {
    const $ = (id) => document.getElementById(id);
    if ($('garage-money')) $('garage-money').textContent = 'CASH: ' + this.hud.fmtMoney(this.state.money);
    if ($('buy-engine')) $('buy-engine').textContent = `BUY $${this.garageCost('engine')} — LV${this.garage.engine}`;
    if ($('buy-armor')) $('buy-armor').textContent = `BUY $${this.garageCost('armor')} — LV${this.garage.armor}`;
    if ($('buy-nitro')) $('buy-nitro').textContent = this.garage.nitro === 0 ? `BUY $${this.garageCost('nitro')}` : `BUY $${this.garageCost('nitro')} — LV${this.garage.nitro}`;
  }

  openGarage() {
    this.refreshGarage();
    document.getElementById('garage')?.classList.add('visible');
  }

  closeGarage() {
    document.getElementById('garage')?.classList.remove('visible');
  }

  // Burning wreck with fire + explosion glow: used for the cover staging and
  // when a car is destroyed in play.
  spawnBurningWreck(x, z, model) {
    const g = new THREE.Group();
    const mesh = buildCarMesh(model || CAR_MODELS[5]);
    mesh.rotation.z = 0.35;
    mesh.rotation.y = Math.random() * Math.PI;
    mesh.position.y = 0.4;
    g.add(mesh);
    // Fire: orange emissive cones.
    const fireMat = new THREE.MeshBasicMaterial({ color: 0xff7a1a });
    const fireMat2 = new THREE.MeshBasicMaterial({ color: 0xffd23f });
    for (let i = 0; i < 4; i++) {
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.7, 2.4 + Math.random(), 6), i % 2 ? fireMat : fireMat2);
      f.position.set((Math.random() - 0.5) * 1.6, 1.6, (Math.random() - 0.5) * 2.4);
      g.add(f);
    }
    // Smoke: dark translucent spheres rising.
    const smokeMat = new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity: 0.55 });
    for (let i = 0; i < 3; i++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(1.1 + i * 0.4, 8, 8), smokeMat);
      s.position.set((Math.random() - 0.5) * 1.2, 3 + i * 1.4, (Math.random() - 0.5) * 1.2);
      g.add(s);
    }
    const light = new THREE.PointLight(0xff6a00, 2.2, 26);
    light.position.y = 3;
    g.add(light);
    g.position.set(x, 0, z);
    this.scene.add(g);
    this.wrecks.push(g);
    return g;
  }

  bindKeys() {
    addEventListener('keydown', (e) => {
      if (e.code === 'KeyM') this.audio.nextStation();
      if (e.code === 'Digit1') { this.weaponIndex = 0; this.hud.setWeapon(0); }
      if (e.code === 'Digit2') { this.weaponIndex = 1; this.hud.setWeapon(1); }
      if (e.code === 'Digit3') { this.weaponIndex = 2; this.hud.setWeapon(2); }
      if (e.code === 'Digit4') { this.weaponIndex = 3; this.hud.setWeapon(3); }
      if (e.code === 'Digit5') { this.weaponIndex = 4; this.hud.setWeapon(4); }
      if (e.code === 'KeyR' && this.state.playing) this.useCrew('fix');
      if (e.code === 'KeyQ' && this.state.playing) this.useCrew('plates');
      if (e.code === 'KeyG' && this.state.playing) {
        const g = document.getElementById('garage');
        if (g.classList.contains('visible')) this.closeGarage(); else this.openGarage();
      }
    });
  }

  showMenu() {
    document.getElementById('menu').classList.add('visible');
    document.getElementById('hud').classList.add('dim');
  }

  hideMenu() {
    document.getElementById('menu').classList.remove('visible');
    document.getElementById('hud').classList.remove('dim');
  }

  startGame(continued) {
    this.hideMenu();
    this.state.playing = true;
    this.audio.ensure();
    if (!continued) {
      this.missions.startMission(0);
      this.state.money = 1250;
      this.state.respect = 24;
    }
    this.pushDialog();
    this.hud.toast(continued ? 'WELCOME BACK TO BRISA SOUND' : 'JOB 01 — FIRST FARE: DRIVE TO ROSA’S DINER');
  }

  placeCameraForMenu() {
    this.camera.position.set(-40, 26, 90);
    this.camera.lookAt(0, 8, 0);
  }

  placeCameraForChase() {
    this.updateCamera(1);
  }

  placeCameraForFoot() {
    this.updateCamera(1);
  }

  updateCamera(dt) {
    const px = this.playerPos.x, pz = this.playerPos.z;
    const back = 8.5, up = 3.4;
    const hx = Math.sin(this.playerHeading), hz = Math.cos(this.playerHeading);
    const tx = px - hx * back, tz = pz - hz * back;
    const ty = (this.city.onBridge(px, pz) ? this.city.bridgeHeight(px) : 0) + up;
    const k = Math.min(1, dt * 4.5);
    this.camera.position.x += (tx - this.camera.position.x) * k;
    this.camera.position.y += (ty - this.camera.position.y) * k;
    this.camera.position.z += (tz - this.camera.position.z) * k;
    this.camera.lookAt(px + hx * 10, (this.city.onBridge(px, pz) ? this.city.bridgeHeight(px) : 0) + 1.4, pz + hz * 10);
  }

  useCrew(id) {
    const c = this.crew.find((x) => x.id === id);
    if (!c || !c.ready) return;
    if (id === 'plates' && this.police.wanted > 0) {
      this.police.wanted = Math.max(0, this.police.wanted - 1);
      this.police.heat = this.police.wanted * 18;
      this.hud.toast('SWAP PLATES — MILO SWAPPED THE PLATES (−1 STAR)');
    } else if (id === 'fix' && this.playerCar) {
      this.playerCar.condition = 100;
      this.hud.toast('QUICK FIX — DARIO REPAIRED THE CAR');
    } else if (id === 'eyes') {
      this.hud.toast('EYES OUT — JUNE MARKS EVERY UNIT ON YOUR MAP');
    } else return;
    c.ready = false;
    setTimeout(() => { c.ready = true; }, 45000);
    this.audio.blip(990, 0.12, 0.12);
  }

  pushDialog() {
    const d = this.missions.nextDialog();
    if (d) {
      this.hud.showDialog(d.who, d.who === 'TÍA ROSA' ? FIXER.role : 'CREW — BRISA SOUND', d.text,
        d.who === 'TÍA ROSA' ? '#ffb36b' : d.who.includes('JUNE') ? '#39d5ff' : '#7dff6a');
      this.dialogTimer = 6;
    }
  }

  enterCar(car, stolen) {
    const boosted = { ...car.model, topSpeed: car.model.topSpeed * (1 + 0.12 * (this.garage.engine - 1)) };
    this.playerCar = new Car(car.mesh, boosted);
    this.playerCar.x = car.x; this.playerCar.z = car.z;
    this.playerCar.heading = car.heading;
    this.playerCar.condition = 100;
    this.state.inCar = true;
    this.player.visible = false;
    if (stolen) {
      this.police.addHeat(26, this.state.time);
      this.hud.toast('CAR STOLEN — BRISA PD ALERTED (+WANTED)');
      this.audio.blip(220, 0.2, 0.15);
    } else {
      this.hud.toast(`DRIVING — ${car.model.name}`);
    }
    // Remove from parked list / traffic.
    this.parkedCars = this.parkedCars.filter((c) => c !== car);
  }

  exitCar() {
    if (!this.playerCar) return;
    const c = this.playerCar;
    const parked = this.spawnParkedCar(c.model, c.x + Math.sin(c.heading + Math.PI / 2) * 3, c.z + Math.cos(c.heading + Math.PI / 2) * 3, c.heading);
    parked.mesh.position.y = c.y;
    this.scene.remove(c.mesh);
    this.playerCar = null;
    this.state.inCar = false;
    this.playerPos = { x: c.x + Math.sin(c.heading + Math.PI / 2) * 2.5, z: c.z + Math.cos(c.heading + Math.PI / 2) * 2.5 };
    this.playerHeading = c.heading;
    this.player.visible = true;
    this.player.position.set(this.playerPos.x, 0, this.playerPos.z);
  }

  tryEnterCar() {
    // Nearest parked car or traffic car.
    let best = null, bd = 7;
    for (const c of this.parkedCars) {
      const d = dist2D(this.playerPos.x, this.playerPos.z, c.x, c.z);
      if (d < bd) { bd = d; best = { car: c, stolen: false }; }
    }
    const t = this.traffic.nearest(this.playerPos.x, this.playerPos.z, 7);
    if (t) {
      const cx = t.axis === 'x' ? t.along : t.road + t.lane;
      const cz = t.axis === 'z' ? t.along : t.road + t.lane;
      const d = dist2D(this.playerPos.x, this.playerPos.z, cx, cz);
      if (d < bd) {
        // Pull the NPC car out of traffic.
        this.traffic.cars = this.traffic.cars.filter((x) => x !== t);
        const heading = t.axis === 'x' ? (t.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (t.dir > 0 ? 0 : Math.PI);
        best = { car: { mesh: t.mesh, model: t.model, x: cx, z: cz, heading }, stolen: true };
      }
    }
    if (best) this.enterCar(best.car, best.stolen);
  }

  combat(dt) {
    this.shotCooldown -= dt;
    // Punch with F.
    if (this.input.wasPressed('KeyF')) {
      const target = this.peds.nearest(this.playerPos.x, this.playerPos.z, 3)
        || this.nearestPolice(3);
      if (target) {
        this.police.addHeat(8, this.state.time);
        this.audio.blip(140, 0.1, 0.2);
        this.hud.toast('PUNCH LANDED — WITNESSES CALLED IT IN');
      }
    }
    // Shoot with mouse click (pistol / SMG / shotgun / rifle).
    if (this.input.mouseClicked && this.weaponIndex > 0 && this.weaponIndex < 5 && this.shotCooldown <= 0 && !this.state.inCar) {
      const stats = [
        null,
        { key: 'pistol', cd: 0.35, range: 45 },
        { key: 'smg', cd: 0.12, range: 40 },
        { key: 'shotgun', cd: 0.8, range: 30 },
        { key: 'rifle', cd: 0.18, range: 60 },
      ][this.weaponIndex];
      this.shotCooldown = stats.cd;
      this.audio.gunshot();
      if (this.weaponAmmo[stats.key] > 0) this.weaponAmmo[stats.key]--;
      this.police.addHeat(10, this.state.time);
      this.peds.update(0, this.playerPos, 0, true);
      // Hit the nearest police unit in range.
      const u = this.nearestPolice(stats.range);
      if (u) {
        u.speed *= 0.3;
        this.hud.toast('HIT — UNIT BACKS OFF');
      }
    }
  }

  nearestPolice(maxDist) {
    let best = null, bd = maxDist;
    for (const u of this.police.units) {
      const d = dist2D(this.playerPos.x, this.playerPos.z, u.x, u.z);
      if (d < bd) { bd = d; best = u; }
    }
    return best;
  }

  tick(dt) {
    this.state.time += dt;
    if (this.shotMode) {
      // Staged shot: simulate a little motion, then freeze ready.
      this.simulate(dt, true);
      this.renderFrame();
      this.shotFrames++;
      if (this.shotFrames === 6) paintShot(this);
      this.input.endFrame();
      return;
    }
    if (this.state.playing) this.simulate(dt, false);
    else {
      // Menu orbit camera.
      const a = this.state.time * 0.05;
      this.camera.position.set(Math.cos(a) * 70, 30, Math.sin(a) * 70);
      this.camera.lookAt(0, 10, 0);
      this.traffic.update(dt, this.playerPos);
      this.peds.update(dt, this.playerPos, 0, false);
    }
    this.renderFrame();
    this.input.endFrame();
  }

  simulate(dt, staged) {
    const st = this.state;
    // Game clock: 1 game minute per 2 real seconds.
    st.gameMinutes += dt * 0.5;
    const hh = Math.floor(st.gameMinutes / 60) % 24;
    const mm = Math.floor(st.gameMinutes % 60);
    const clock = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;

    if (this.dialogTimer > 0) {
      this.dialogTimer -= dt;
      if (this.dialogTimer <= 0) this.hud.hideDialog();
    }

    if (st.autopilot && st.inCar && this.playerCar) this.autopilotDrive(dt);

    if (st.inCar && this.playerCar) {
      if (staged) {
        // Staged shot: hold the composed frame — no driving, no drift.
        st.speedKmh = this.playerCar.speed * 3.6;
        this.playerPos = { x: this.playerCar.x, z: this.playerCar.z };
        this.playerHeading = this.playerCar.heading;
        this.playerSpeed = this.playerCar.speed;
        this.playerCar.y = this.city.onBridge(this.playerCar.x, this.playerCar.z) ? this.city.bridgeHeight(this.playerCar.x) : 0;
        this.playerCar.mesh.position.set(this.playerCar.x, this.playerCar.y, this.playerCar.z);
        this.playerCar.mesh.rotation.y = this.playerCar.heading;
      } else {
      const prevSpeed = this.playerCar.speed;
      this.playerCar.update(dt, this.input, this.city, (impact) => {
        this.audio.crash(clamp(impact / 30, 0.3, 1));
        this.police.addHeat(6, st.time);
        // Armor upgrade refunds part of the crash damage.
        if (this.garage.armor > 1) {
          this.playerCar.condition = Math.min(100, this.playerCar.condition + impact * 0.4 * 0.15 * (this.garage.armor - 1));
        }
        if (this.playerCar.condition <= 0) this.spawnBurningWreck(this.playerCar.x, this.playerCar.z, this.playerCar.model);
      });
      // Nitro boost (SHIFT) when the garage fitted it.
      if (this.garage.nitro > 0 && (this.input.isDown('ShiftLeft') || this.input.isDown('ShiftRight')) && this.nitroFuel > 0) {
        this.playerCar.speed = Math.min(this.playerCar.model.topSpeed * 1.35, this.playerCar.speed + 20 * dt);
        this.nitroFuel = Math.max(0, this.nitroFuel - dt * 25);
      } else {
        this.nitroFuel = Math.min(100, this.nitroFuel + dt * 6);
      }
      st.speedKmh = this.playerCar.speed * 3.6;
      this.playerPos = { x: this.playerCar.x, z: this.playerCar.z };
      this.playerHeading = this.playerCar.heading;
      this.playerSpeed = this.playerCar.speed;
      // Bumping traffic cars.
      for (const tc of this.traffic.cars) {
        const cx = tc.axis === 'x' ? tc.along : tc.road + tc.lane;
        const cz = tc.axis === 'z' ? tc.along : tc.road + tc.lane;
        if (dist2D(this.playerPos.x, this.playerPos.z, cx, cz) < 3.4 && Math.abs(prevSpeed) > 5) {
          tc.wait = 1.2;
          this.police.addHeat(5, st.time);
          this.audio.crash(0.5);
          this.playerCar.speed *= 0.6;
        }
      }
      if (this.input.wasPressed('KeyE')) this.exitCar();
      }
    } else {
      // On foot.
      const axes = this.input.walkAxes();
      const run = this.input.isDown('ShiftLeft') || this.input.isDown('ShiftRight');
      const speed = run ? 9 : 5;
      const moving = axes.fwd !== 0 || axes.strafe !== 0;
      if (moving) {
        const camA = this.playerHeading;
        const mx = Math.sin(camA) * axes.fwd + Math.cos(camA) * axes.strafe;
        const mz = Math.cos(camA) * axes.fwd - Math.sin(camA) * axes.strafe;
        const len = Math.hypot(mx, mz) || 1;
        const nx = this.playerPos.x + (mx / len) * speed * dt;
        const nz = this.playerPos.z + (mz / len) * speed * dt;
        const fixed = this.city.collide(nx, nz, 0.8);
        this.playerPos = fixed;
        this.playerHeading = Math.atan2(mx, mz);
        this.playerSpeed = speed;
      } else this.playerSpeed = 0;
      this.player.position.set(this.playerPos.x, 0, this.playerPos.z);
      this.player.rotation.y = this.playerHeading;
      st.speedKmh = 0;
      if (this.input.wasPressed('KeyE')) this.tryEnterCar();
      this.combat(dt);
    }

    // Mission progress.
    const m = this.missions;
    const evt = m.update(dt, this.playerPos, st.inCar, this.police.wanted);
    if (evt) {
      if (evt.type === 'complete') {
        st.money += evt.payout.money;
        st.respect += evt.payout.respect;
        const sd0 = HUD.streetAndDistrict(this.playerPos.x, this.playerPos.z);
        this.standing[sd0.district] = Math.min(100, (this.standing[sd0.district] || 0) + 8);
        this.audio.blip(880, 0.15, 0.15);
        setTimeout(() => this.audio.blip(1320, 0.2, 0.15), 140);
        this.hud.toast(`JOB COMPLETE — ${evt.payout.name}  +$${evt.payout.money}  +${evt.payout.respect} RESPECT`);
        this.saveGame();
        if (m.state === 'story-complete') {
          st.storyDone = true;
          this.hud.showDialog('TÍA ROSA', FIXER.role, 'Seven jobs, one night. Brisa Sound is ours now, mijo. You did it.');
          this.hud.toast('STORY COMPLETE — BRISA SOUND IS YOURS');
        } else {
          m.next();
          this.pushDialog();
        }
      } else if (evt.type === 'failed') {
        this.hud.toast(`JOB FAILED — ${evt.reason}. PRESS R TO RETRY`);
        this.audio.blip(180, 0.3, 0.2);
      } else if (evt.type === 'checkpoint') {
        this.audio.blip(1100, 0.1, 0.12);
        this.hud.toast(evt.note || `CHECKPOINT ${evt.stage}/${evt.total} — KEEP GOING`);
      }
    }
    if (this.input.wasPressed('KeyR') && m.state === 'failed') {
      m.retry();
      this.pushDialog();
      this.hud.toast('JOB RESTARTED');
    }

    // Side activities: taxi (T near a stand), courier (C), race (drive
    // through the start line), orbs (walk/drive over them).
    if (this.input.wasPressed('KeyT') && st.inCar) {
      const stand = this.side.nearestStand(this.playerPos.x, this.playerPos.z, 14);
      if (stand) {
        const ev = this.side.startTaxi(this.playerPos);
        if (ev) this.hud.toast(`TAXI — PICK UP THE FARE ($${ev.fare}) — FOLLOW THE GOLD BEACON`);
      } else {
        this.hud.toast('TAXI — DRIVE TO A TAXI STAND FIRST (GOLD “T” ON THE MAP)');
      }
    }
    if (this.input.wasPressed('KeyC')) {
      const ev = this.side.startCourier();
      if (ev) this.hud.toast(`COURIER — COLLECT ${ev.total} PARCELS AROUND THE CITY`);
    }
    if (st.inCar && this.side.race.state === 'idle' && this.side.nearRaceStart(this.playerPos.x, this.playerPos.z)) {
      const ev = this.side.startRace();
      if (ev) this.hud.toast(`STREET RACE — ${ev.gates} GATES, 120s. GO!`);
    }
    for (const ev of this.side.update(dt, this.playerPos, st.inCar)) {
      if (ev.type === 'taxi-pickup') this.hud.toast('FARE ABOARD — DRIVE TO THE DROP-OFF');
      if (ev.type === 'taxi-done') { st.money += ev.money; this.hud.toast(`FARE DELIVERED +$${ev.money}`); this.audio.blip(1100, 0.12, 0.12); this.saveGame(); }
      if (ev.type === 'race-gate') this.hud.toast(`RACE GATE ${ev.gate}/${ev.total}`);
      if (ev.type === 'race-done') {
        st.money += ev.money;
        this.hud.toast(`RACE WON +$${ev.money} — ${ev.time.toFixed(1)}s${ev.best ? ' — NEW BEST!' : ''}`);
        this.audio.blip(1320, 0.2, 0.15); this.saveGame();
      }
      if (ev.type === 'race-failed') this.hud.toast('RACE FAILED — TIME UP. DRIVE THROUGH THE START LINE TO RETRY');
      if (ev.type === 'courier-pickup') this.hud.toast(`PARCEL ${ev.n}/${ev.total} COLLECTED`);
      if (ev.type === 'courier-done') { st.money += ev.money; this.hud.toast(`ALL PARCELS DELIVERED +$${ev.money}`); this.audio.blip(1100, 0.12, 0.12); this.saveGame(); }
      if (ev.type === 'orb') { st.money += ev.money; this.hud.toast(`NEON ORB ${ev.n}/${ev.total} +$${ev.money}`); this.audio.blip(1560, 0.1, 0.1); }
    }

    // Force wanted for the escape mission staging.
    if (m.mission.forceWanted && m.state === 'active' && this.police.wanted < m.mission.forceWanted) {
      this.police.addHeat(30, st.time);
    }

    // Traffic, peds, police — frozen in staged shots so the composed frame
    // (police positions, heli, wreck) does not drift before the capture.
    if (!staged) {
      this.traffic.update(dt, this.playerPos);
      this.peds.update(dt, this.playerPos, this.playerSpeed, false);
      this.police.update(dt, this.playerPos, this.playerSpeed, this.city, st.time, (unit) => {
        this.audio.crash(0.6);
        if (this.playerCar) this.playerCar.condition = Math.max(0, this.playerCar.condition - 4);
        else st.health = Math.max(0, st.health - 6);
      });
    }
    if (this.playerCar && this.playerCar.condition <= 0) this.playerCar.speed = Math.min(this.playerCar.speed, 4);

    // Health regen when calm.
    if (this.police.wanted === 0 && st.health < 100) st.health = Math.min(100, st.health + dt * 1.5);

    // Beacon + marker at the current target: side job first, then the story.
    const target = this.side.currentTarget() || m.currentTarget;
    if (target && m.state === 'active') {
      this.beacon.visible = true;
      this.marker.visible = true;
      this.beacon.position.set(target.x, 30, target.z);
      this.marker.position.set(target.x, 6 + Math.sin(st.time * 2.5) * 0.8, target.z);
      this.marker.rotation.y += dt * 2;
    } else {
      this.beacon.visible = false;
      this.marker.visible = false;
    }

    // Camera + audio.
    this.updateCamera(dt);
    // Day/night cycle follows the game clock; rain rolls in on a timer.
    const dayF = this.city.setTimeOfDay(hh + mm / 60);
    if (!staged) {
      this.rainTimer -= dt;
      if (this.rainTimer <= 0) {
        this.rainOn = Math.random() < 0.35;
        this.city.setRain(this.rainOn);
        this.rainTimer = 60 + Math.random() * 60;
      }
      this.city.updateRain(dt, this.playerPos.x, this.playerPos.z);
    }
    this.audio.setEngine(clamp(Math.abs(st.speedKmh) / 160, 0, 1), st.inCar);
    this.audio.setSiren(this.police.wanted);
    if (this.input.wasPressed('KeyM')) this.hud.toast(`RADIO — ${this.audio.currentStation()}`);

    // HUD state.
    const sd = HUD.streetAndDistrict(this.playerPos.x, this.playerPos.z);
    const wanted = st.wantedOverride || this.police.wanted;
    const targetDist = target ? dist2D(this.playerPos.x, this.playerPos.z, target.x, target.z) : null;
    const totalStages = m.mission.checkpoints ? m.mission.checkpoints.length : m.mission.stealAt ? 2 : 1;
    const doneStages = m.mission.checkpoints ? m.stage : m.mission.stealAt ? m.stage : (m.state === 'done' ? 1 : 0);
    const weatherLabel = this.rainOn ? '🌧 RAIN — WET ROADS'
      : dayF > 0.9 ? '☀ DAY — CLEAR' : dayF > 0.35 ? '🌆 DUSK — CLEAR' : '🌙 NIGHT — CLEAR';
    this.hud.update({
      mission: m.mission,
      missionStage: m.progressText(),
      objective: m.state === 'failed' ? 'JOB FAILED — PRESS R TO RETRY' : m.objectiveText,
      missionNext: m.index + 1 < 10 ? `NEXT: ${['HOT PLATES', 'NEON RUN', 'HARBOR LIGHTS', 'SIREN SONG', 'THE LONG BRIDGE', 'BRISA NIGHTS', 'DEAD DROP', 'STREET KINGS', 'MIDNIGHT LEDGER'][m.index]}` : 'FINAL JOB',
      timeLeft: m.timeLeft,
      missionProgress: totalStages ? doneStages / totalStages : 0,
      targetDist,
      clock,
      money: st.money,
      wanted,
      respect: st.respect,
      rank: st.respect < 40 ? 'ROOKIE' : st.respect < 80 ? 'HUSTLER' : st.respect < 140 ? 'PLAYER' : 'KINGPIN',
      dispatch: this.police.dispatchList(),
      health: st.health,
      armor: st.armor,
      speedKmh: st.speedKmh,
      inCar: st.inCar,
      carName: this.playerCar ? this.playerCar.model.name : 'ON FOOT',
      carCondition: this.playerCar ? this.playerCar.condition : 100,
      radio: this.audio.currentStation(),
      crew: this.crew,
      street: sd.street,
      district: sd.district,
      standing: this.standing[sd.district] ?? 0,
      sideLine: this.side.statusLine(),
      weather: weatherLabel,
      garage: this.garage,
      target,
      player: this.playerPos,
      heading: this.playerHeading,
      policeDots: this.police.units.map((u) => ({ x: u.x, z: u.z })),
    });
  }

  autopilotDrive(dt) {
    const car = this.playerCar;
    const target = this.missions.currentTarget;
    if (!target) return;
    const dx = target.x - car.x, dz = target.z - car.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 3) return;
    const desired = Math.atan2(dx, dz);
    let diff = desired - car.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.heading += clamp(diff, -1, 1) * 1.8 * dt;
    car.speed = clamp(car.speed + (dist > 30 ? 22 : 10) * dt, -6, dist > 40 ? 34 : 16);
    const nx = car.x + Math.sin(car.heading) * car.speed * dt;
    const nz = car.z + Math.cos(car.heading) * car.speed * dt;
    const fixed = this.city.collide(nx, nz, 2.2);
    car.x = fixed.x; car.z = fixed.z;
    car.y = this.city.onBridge(car.x, car.z) ? this.city.bridgeHeight(car.x) : 0;
    car.mesh.position.set(car.x, car.y, car.z);
    car.mesh.rotation.y = car.heading;
  }

  saveGame() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        money: this.state.money,
        respect: this.state.respect,
        mission: this.missions.index,
        health: this.state.health,
        garage: this.garage,
        standing: this.standing,
        orbs: this.side.orbs.collected,
      }));
    } catch { /* storage unavailable */ }
  }

  loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const s = JSON.parse(raw);
      this.state.money = s.money ?? this.state.money;
      this.state.respect = s.respect ?? this.state.respect;
      if (typeof s.mission === 'number') this.missions.startMission(Math.min(s.mission, 9));
      if (s.garage) this.garage = { ...this.garage, ...s.garage };
      if (s.standing) this.standing = { ...this.standing, ...s.standing };
      return true;
    } catch { return false; }
  }

  onResize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
  }

  renderFrame() {
    this.renderer.render(this.scene, this.camera);
  }
}

new Game();
