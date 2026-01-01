import { InputState } from "../types/game";

export class Input {
  state: InputState = {
    left: false,
    right: false,
    up: false,
    down: false,
  };

  constructor() {
    this.setupListeners();
  }

  private setupListeners(): void {
    window.addEventListener("keydown", (e) => this.handleKey(e, true));
    window.addEventListener("keyup", (e) => this.handleKey(e, false));
  }

  private handleKey(e: KeyboardEvent, pressed: boolean): void {
    switch (e.key) {
      case "ArrowLeft":
      case "a":
      case "A":
        this.state.left = pressed;
        break;
      case "ArrowRight":
      case "d":
      case "D":
        this.state.right = pressed;
        break;
      case "ArrowUp":
      case "w":
      case "W":
        this.state.up = pressed;
        break;
      case "ArrowDown":
      case "s":
      case "S":
        this.state.down = pressed;
        break;
    }
  }
}
