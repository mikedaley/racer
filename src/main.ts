import { Game } from "./core/Game";
import { Editor } from "./editor/TrackEditor";
import { SpriteSheetEditor } from "./editor/SpriteSheetEditor";
import {
  TrackData,
  loadTrackData,
  createDefaultTrackData,
} from "./data/TrackData";

// Screen elements
const editorScreen = document.getElementById("editor-screen")!;
const gameScreen = document.getElementById("game-screen")!;
const gameCanvas = document.getElementById("game") as HTMLCanvasElement;
const previewCanvas = document.getElementById(
  "preview-canvas",
) as HTMLCanvasElement;

let game: Game | null = null;
let editor: Editor | null = null;
let spriteEditor: SpriteSheetEditor | null = null;

function showEditor(): void {
  // Get current track data from game before stopping it
  let currentTrackData: TrackData | null = null;
  if (game) {
    currentTrackData = game.getTrackData();
    game.stop();
    game = null;
  }

  gameScreen.classList.remove("active");
  editorScreen.classList.add("active");

  // Initialize editor on first use, or load the current track data
  if (!editor) {
    editor = new Editor(previewCanvas, showGame, currentTrackData || undefined);
  } else if (currentTrackData) {
    editor.loadTrackData(currentTrackData);
  }
}

function showGame(trackData: TrackData): void {
  editorScreen.classList.remove("active");
  gameScreen.classList.add("active");

  // Resize canvas to fill screen
  gameCanvas.width = window.innerWidth;
  gameCanvas.height = window.innerHeight;

  game = new Game(gameCanvas, trackData, showEditor);
  game.start();
}

// Start game immediately with saved or default track
const savedTrack = loadTrackData();
const trackData = savedTrack || createDefaultTrackData();
showGame(trackData);

// Handle window resize for game
window.addEventListener("resize", () => {
  if (gameScreen.classList.contains("active") && game) {
    gameCanvas.width = window.innerWidth;
    gameCanvas.height = window.innerHeight;
  }
});

// Keyboard shortcut for sprite sheet editor (press 'S' while in game or editor)
window.addEventListener("keydown", (e) => {
  if (e.key === "s" || e.key === "S") {
    // Only open if not typing in an input
    const activeEl = document.activeElement;
    if (
      activeEl instanceof HTMLInputElement ||
      activeEl instanceof HTMLTextAreaElement
    ) {
      return;
    }

    // Toggle sprite editor
    const spriteEditorScreen = document.getElementById("sprite-editor-screen");
    if (spriteEditorScreen?.classList.contains("active")) {
      // Already in sprite editor, do nothing
      return;
    }

    // Open sprite editor
    if (!spriteEditor) {
      spriteEditor = new SpriteSheetEditor();
    }
    if (game) {
      game.stop();
      game = null;
    }
    spriteEditor.show();
  }
});
