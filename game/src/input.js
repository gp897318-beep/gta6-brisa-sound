// Keyboard + mouse input for Brisa Sound. Tracks held keys, edge presses, and
// pointer state so driving, walking, combat and menus all read from one place.
export class Input {
  constructor() {
    this.keys = new Set();
    this.pressed = new Set();
    this.mouseDown = false;
    this.mouseClicked = false;
    this.mouseX = 0;
    this.mouseY = 0;
    this.enabled = true;
    window.addEventListener('keydown', (e) => {
      if (!this.enabled) return;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.key)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); });
    window.addEventListener('mousedown', (e) => {
      this.mouseDown = true; this.mouseClicked = true;
      this.mouseX = e.clientX; this.mouseY = e.clientY;
    });
    window.addEventListener('mouseup', () => { this.mouseDown = false; });
  }

  isDown(code) { return this.keys.has(code); }
  wasPressed(code) { return this.pressed.has(code); }

  // WASD + arrows as one driving axis: forward/back and left/right.
  driveAxes() {
    const fwd = (this.isDown('KeyW') || this.isDown('ArrowUp') ? 1 : 0)
      - (this.isDown('KeyS') || this.isDown('ArrowDown') ? 1 : 0);
    const steer = (this.isDown('KeyA') || this.isDown('ArrowLeft') ? 1 : 0)
      - (this.isDown('KeyD') || this.isDown('ArrowRight') ? 1 : 0);
    return { fwd, steer };
  }

  walkAxes() {
    const fwd = (this.isDown('KeyW') || this.isDown('ArrowUp') ? 1 : 0)
      - (this.isDown('KeyS') || this.isDown('ArrowDown') ? 1 : 0);
    const strafe = (this.isDown('KeyD') || this.isDown('ArrowRight') ? 1 : 0)
      - (this.isDown('KeyA') || this.isDown('ArrowLeft') ? 1 : 0);
    return { fwd, strafe };
  }

  endFrame() {
    this.pressed.clear();
    this.mouseClicked = false;
  }
}
