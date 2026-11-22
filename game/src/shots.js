// Screenshot staging for Brisa Sound: ?shot=cover|drive|mission|menu with
// &seed=N places the player, cars, police and helicopter in a composed scene,
// then paints twice and sets window.__shotReady for the screenshot runner.
import { CAR_MODELS } from './cars.js';

export function stageShot(game, mode) {
  const g = game;
  g.hideMenu();
  g.state.playing = true;
  g.audio.ensure();
  if (mode === 'menu') {
    g.showMenu();
    g.state.playing = false;
    g.placeCameraForMenu();
    return;
  }
  if (mode === 'cover') {
    // FIVE-STAR CHAOS on the Coral Span approach: player in the Calyx Sprint
    // GT at speed, a burning wreck with explosion glow ahead, roadblock
    // cruisers + SWAT closing in, heli ahead overhead with the spotlight on.
    g.spawnPlayerCarAt(108, 0, Math.PI / 2, CAR_MODELS[0]);
    g.playerCar.speed = 24;
    g.spawnBurningWreck(121, 4, CAR_MODELS[5]);
    g.police.addHeat(95, g.state.time);
    g.police.syncUnits({ x: 108, z: 0 });
    g.police.spotAngle = 0; // heli ahead, in frame
    const spots = [
      { x: 126, z: -4, heading: -Math.PI / 2, tactic: 'ROADBLOCK' },
      { x: 130, z: 5, heading: -Math.PI / 2, tactic: 'RAMMING' },
      { x: 92, z: 7, heading: Math.PI / 2, tactic: 'FLANKING' },
      { x: 96, z: -6, heading: Math.PI / 2, tactic: 'PURSUE' },
      { x: 116, z: -7, heading: Math.PI / 2, tactic: 'PIT' },
      { x: 114, z: 7, heading: Math.PI / 2, tactic: 'CLOSING IN' },
    ];
    g.police.units.forEach((u, i) => {
      const s = spots[i % spots.length];
      u.x = s.x; u.z = s.z; u.heading = s.heading; u.tactic = s.tactic;
      u.dist = Math.round(Math.hypot(s.x - 108, s.z));
    });
    // Place cruiser meshes + heli once (staged frames freeze police motion).
    g.police.update(0.001, { x: 108, z: 0 }, 0, g.city, g.state.time, null);
    g.state.wantedOverride = 5;
    g.state.mission = g.missions.mission;
    g.hud.showDialog('TÍA ROSA', 'FIXER — ROSA’S DINER', 'They’re all over you, mijo! Punch it over the Span — don’t stop for anyone!');
    g.placeCameraForChase();
    return;
  }
  if (mode === 'drive') {
    // Golden dusk cruise down Palm Row with traffic and a 1-star tail:
    // one cruiser ahead facing the player, one alongside.
    g.spawnPlayerCarAt(-40, 150, 0, CAR_MODELS[4]);
    g.playerCar.speed = 26;
    g.police.addHeat(18, g.state.time);
    g.police.syncUnits({ x: -40, z: 150 });
    g.police.units.forEach((u, i) => {
      const spots = [
        { x: -40, z: 178, heading: Math.PI, tactic: 'ROADBLOCK' },
        { x: -31, z: 166, heading: 0, tactic: 'PURSUE' },
      ];
      const s = spots[i % spots.length];
      u.x = s.x; u.z = s.z; u.heading = s.heading; u.tactic = s.tactic;
      u.dist = Math.round(Math.hypot(s.x + 40, s.z - 150));
    });
    g.police.update(0.001, { x: -40, z: 150 }, 0, g.city, g.state.time, null);
    g.hud.showDialog('MILO “SPARROW” VANE', 'DRIVER — CREW', 'Easy on the throttle through Palm Row. The whole city is watching the sunset — and us.');
    g.placeCameraForChase();
    return;
  }
  if (mode === 'mission') {
    // On foot on Neon Mile, facing east down the road toward the diner
    // intersection — gold beacon ahead, fixer dialogue up.
    g.spawnPlayerOnFoot(36, -120, Math.PI / 2);
    g.missions.startMission(0);
    g.hud.showDialog('TÍA ROSA', 'FIXER — ROSA’S DINER, NEON MILE', 'Mijo, the city eats the slow. Take the Calyx, bring my package back in one piece.');
    g.placeCameraForFoot();
    return;
  }
  // Default: cover.
  stageShot(game, 'cover');
}

export function paintShot(game) {
  game.renderFrame();
  game.renderFrame();
  window.__shotReady = true;
}
