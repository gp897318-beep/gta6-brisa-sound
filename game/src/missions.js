// BRISA SOUND — missions.js: story jobs from fixer Tía Rosa, in order.
// 7 missions, each with an objective marker, a timer where it matters,
// dialogue, and a cash + respect payout. Completing all 7 finishes the story.
import { dist2D } from './random.js';

export const CREW = [
  { id: 'plates', name: 'SWAP PLATES', desc: 'Milo "Sparrow" Vane — drops 1 wanted star', ready: true },
  { id: 'fix', name: 'QUICK FIX', desc: 'Dario Cole — repairs the car to 100%', ready: true },
  { id: 'eyes', name: 'EYES OUT', desc: 'June Park — marks police on the minimap', ready: true },
];

export const FIXER = { name: 'TÍA ROSA', role: 'FIXER — ROSA’S DINER, NEON MILE' };

export const MISSIONS = [
  {
    id: 'first-fare', name: 'FIRST FARE', job: 'JOB 01',
    brief: 'Rosa needs a courier she can trust. Drive to the diner on Neon Mile and pick up the package.',
    objective: 'Drive to Rosa’s Diner',
    target: { x: 60, z: -120 }, radius: 10, timer: 0,
    reward: 350, respect: 12,
    dialog: [
      { who: 'TÍA ROSA', text: 'Mijo, the city eats the slow. Take the Calyx, bring my package back in one piece.' },
      { who: 'MILO “SPARROW” VANE', text: 'Keys are in it. Don’t scratch the paint — Rosa counts every scratch.' },
    ],
  },
  {
    id: 'hot-plates', name: 'HOT PLATES', job: 'JOB 02',
    brief: 'The package goes to the marina. Cops are thick on Harbour Road tonight — keep it smooth.',
    objective: 'Deliver the package to Marina Del Sol',
    target: { x: 250, z: 60 }, radius: 12, timer: 150,
    reward: 600, respect: 15,
    dialog: [
      { who: 'TÍA ROSA', text: 'A buyer waits at the docks. Two minutes late and the price halves, cariño.' },
      { who: 'JUNE PARK', text: 'Eyes out: two cruisers on Harbour Road. Take the Span, it’s clear.' },
    ],
  },
  {
    id: 'neon-run', name: 'NEON RUN', job: 'JOB 03',
    brief: 'A midnight sprint down Neon Mile. Hit all three checkpoints before the clock dies.',
    objective: 'Hit 3 checkpoints on Neon Mile',
    target: { x: 120, z: -120 }, radius: 10, timer: 120,
    checkpoints: [{ x: 120, z: -120 }, { x: 0, z: -120 }, { x: -120, z: -120 }],
    reward: 900, respect: 20,
    dialog: [
      { who: 'MILO “SPARROW” VANE', text: 'Three gates, one straight line, no brakes. Show them what the Sprint can do.' },
      { who: 'DARIO COLE', text: 'You bin it, I fix it. You win it, Rosa pays double.' },
    ],
  },
  {
    id: 'harbor-lights', name: 'HARBOR LIGHTS', job: 'JOB 04',
    brief: 'A Lumen Coupe is parked by the marina, keys in the sun visor. Take it — quietly — and bring it to the garage.',
    objective: 'Steal the Lumen Coupe, deliver to the garage',
    target: { x: 230, z: 30 }, radius: 8, timer: 0,
    stealAt: { x: 230, z: 30 },
    deliverAt: { x: -60, z: 60 },
    reward: 1200, respect: 25,
    dialog: [
      { who: 'TÍA ROSA', text: 'Some tourist left a Coupe at the marina. It wants a new home. Yours, maybe.' },
      { who: 'JUNE PARK', text: 'No cameras on that dock. Walk in like you own it — because soon, you do.' },
    ],
  },
  {
    id: 'siren-song', name: 'SIREN SONG', job: 'JOB 05',
    brief: 'The heat is on. Lose a 3-star wanted level — break line of sight, then stay clean until the stars fade.',
    objective: 'Lose the police (survive 3 stars)',
    target: { x: -120, z: 120 }, radius: 14, timer: 180,
    forceWanted: 3,
    reward: 1500, respect: 30,
    dialog: [
      { who: 'TÍA ROSA', text: 'You stirred the whole precinct, mijo. Now disappear. The Span, the alleys — vanish.' },
      { who: 'MILO “SPARROW” VANE', text: 'Swap the plates when you’re clear. I’ll be listening on the scanner.' },
    ],
  },
  {
    id: 'long-bridge', name: 'THE LONG BRIDGE', job: 'JOB 06',
    brief: 'A courier run across the Coral Span at full tilt — and the PD has set a roadblock on the far side.',
    objective: 'Cross the Coral Span to the beach',
    target: { x: 250, z: 0 }, radius: 12, timer: 100,
    reward: 2000, respect: 35,
    dialog: [
      { who: 'DARIO COLE', text: 'Roadblock on the far side. Don’t stop, don’t swerve — punch straight through.' },
      { who: 'JUNE PARK', text: 'Heli is up. Stay on the deck, the cables hide you from the spotlight.' },
    ],
  },
  {
    id: 'brisa-nights', name: 'BRISA NIGHTS', job: 'JOB 07',
    brief: 'The final job: deliver the ledger to the Lumen Tower in Downtown Brisa, then get clear. The whole city is watching.',
    objective: 'Deliver the ledger to Lumen Tower',
    target: { x: -30, z: -30 }, radius: 12, timer: 200,
    reward: 3500, respect: 50,
    dialog: [
      { who: 'TÍA ROSA', text: 'Seven jobs, one night. Bring me that ledger and Brisa Sound is ours, mijo.' },
      { who: 'MILO “SPARROW” VANE', text: 'Last run. Drive like the dawn owes you money.' },
    ],
  },
  {
    id: 'dead-drop', name: 'DEAD DROP', job: 'JOB 08',
    brief: 'Two drops, two ends of the city. Beach first, then the north docks. No stops, no questions.',
    objective: 'Make 2 dead drops',
    target: { x: 230, z: -60 }, radius: 10, timer: 180,
    checkpoints: [{ x: 230, z: -60 }, { x: 180, z: 120 }],
    reward: 1600, respect: 28,
    dialog: [
      { who: 'JUNE PARK', text: 'Drop one is buried by the lifeguard tower. Drop two is under the north dock. I’ll ping you when each is clear.' },
      { who: 'TÍA ROSA', text: 'You’ve got the whole city talking, mijo. Keep it quiet tonight.' },
    ],
  },
  {
    id: 'street-kings', name: 'STREET KINGS', job: 'JOB 09',
    brief: 'An unsanctioned sprint through Downtown — four gates, one clock, and every crew in Brisa Sound watching.',
    objective: 'Win the street race (4 gates)',
    target: { x: 120, z: 60 }, radius: 10, timer: 150,
    checkpoints: [{ x: 120, z: 60 }, { x: 0, z: 60 }, { x: -120, z: 60 }, { x: -120, z: -60 }],
    reward: 2200, respect: 35,
    dialog: [
      { who: 'MILO “SPARROW” VANE', text: 'Four gates, no brakes, no mercy. The Kings don’t lose on their own streets.' },
      { who: 'DARIO COLE', text: 'I tuned the Sprint for this. Don’t lift — not once.' },
    ],
  },
  {
    id: 'midnight-ledger', name: 'MIDNIGHT LEDGER', job: 'JOB 10',
    brief: 'The ledger goes to the top of Lumen Tower at midnight. Every unit in the city will be looking for you. Finish the story.',
    objective: 'Deliver the ledger to Lumen Tower',
    target: { x: -30, z: -30 }, radius: 12, timer: 220,
    reward: 4000, respect: 60,
    dialog: [
      { who: 'TÍA ROSA', text: 'Ten jobs. One night. Bring me that ledger and Brisa Sound is ours — forever, mijo.' },
      { who: 'JUNE PARK', text: 'PD is sweeping every bridge. Take the alleys. I’ll keep the heli blind.' },
    ],
  },
];

export class MissionManager {
  constructor() {
    this.index = 0;
    this.stage = 0; // checkpoint stage within the mission
    this.timeLeft = 0;
    this.state = 'active'; // active | done | failed | story-complete
    this.dialogQueue = [];
    this.dialogShown = false;
    this.objectiveText = '';
    this.currentTarget = null;
    this.startMission(0);
  }

  get mission() { return MISSIONS[this.index]; }

  startMission(i) {
    this.index = i;
    this.stage = 0;
    this.state = 'active';
    this.dialogShown = false;
    const m = MISSIONS[i];
    this.timeLeft = m.timer || 0;
    this.dialogQueue = [...m.dialog];
    this.currentTarget = m.checkpoints ? m.checkpoints[0] : m.target;
    this.objectiveText = m.objective;
  }

  update(dt, playerPos, inCar, wanted) {
    if (this.state !== 'active') return null;
    const m = this.mission;
    if (this.timeLeft > 0) {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) {
        this.state = 'failed';
        return { type: 'failed', reason: 'Time ran out' };
      }
    }
    // Checkpoint missions advance through their gates.
    if (m.checkpoints) {
      const cp = m.checkpoints[this.stage];
      if (cp && dist2D(playerPos.x, playerPos.z, cp.x, cp.z) < m.radius) {
        this.stage++;
        if (this.stage >= m.checkpoints.length) return this.complete();
        this.currentTarget = m.checkpoints[this.stage];
        return { type: 'checkpoint', stage: this.stage, total: m.checkpoints.length };
      }
      return null;
    }
    // Steal mission: two phases — reach the car, then deliver it.
    if (m.stealAt) {
      const goal = this.stage === 0 ? m.stealAt : m.deliverAt;
      if (dist2D(playerPos.x, playerPos.z, goal.x, goal.z) < m.radius) {
        if (this.stage === 0) {
          this.stage = 1;
          this.currentTarget = m.deliverAt;
          return { type: 'checkpoint', stage: 1, total: 2, note: 'Car taken — deliver it to the garage' };
        }
        return this.complete();
      }
      return null;
    }
    if (this.currentTarget && dist2D(playerPos.x, playerPos.z, this.currentTarget.x, this.currentTarget.z) < m.radius) {
      if (m.forceWanted && wanted > 0) return null; // must lose the heat first
      return this.complete();
    }
    return null;
  }

  complete() {
    const m = this.mission;
    this.state = 'done';
    const payout = { money: m.reward, respect: m.respect, name: m.name };
    if (this.index + 1 >= MISSIONS.length) {
      this.state = 'story-complete';
    }
    return { type: 'complete', payout };
  }

  next() {
    if (this.index + 1 < MISSIONS.length) this.startMission(this.index + 1);
  }

  retry() {
    this.startMission(this.index);
  }

  progressText() {
    const m = this.mission;
    if (m.checkpoints) return `STAGE ${this.stage + 1}/${m.checkpoints.length}`;
    if (m.stealAt) return `STAGE ${this.stage + 1}/2`;
    return `STAGE 1/1`;
  }

  nextDialog() {
    if (this.dialogQueue.length === 0) return null;
    return this.dialogQueue.shift();
  }
}
