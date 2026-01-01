# Racer

A retro-style pseudo-3D racing game built with TypeScript and WebGL2, inspired by classic arcade racers like OutRun.

## Features

- GPU-accelerated WebGL2 rendering
- Retro 512x384 resolution upscaled for a pixelated aesthetic
- Pseudo-3D road with curves and hills
- Roadside sprites with distance fog
- Track editor with 2D overview, elevation profile, and 3D preview
- Customizable physics parameters
- Track persistence via localStorage

## Architecture

### Rendering Pipeline

The game uses a WebGL2-based rendering pipeline that maintains visual parity with classic pseudo-3D racing games while leveraging GPU acceleration.

```
Game.render()
  └── WebGLRenderer.render(track, position, playerX, playerY, steerDirection)
        ├── renderSky()           # Fullscreen quad with gradient shader
        ├── project() loop        # CPU-side perspective projection
        ├── buildSegmentGeometry() # Generate road triangles
        ├── renderRoad()          # Draw road, rumble strips, lane markers
        ├── renderSprites()       # Billboarded sprite quads (back-to-front)
        ├── renderPlayer()        # Player car sprite
        └── Upscale to display    # 512x384 → window size (nearest filtering)
```

### Directory Structure

```
src/
├── core/
│   ├── Game.ts              # Main game loop, physics, input handling
│   ├── Track.ts             # Track generation and segment management
│   ├── Input.ts             # Keyboard input handling
│   ├── WebGLRenderer.ts     # WebGL2 renderer implementation
│   ├── WebGLUtils.ts        # Shader compilation, buffer helpers
│   ├── shaders/
│   │   ├── sky.vert         # Sky gradient vertex shader
│   │   ├── sky.frag         # Sky gradient fragment shader
│   │   ├── road.vert        # Road segment vertex shader
│   │   ├── road.frag        # Road segment fragment shader (with fog)
│   │   ├── sprite.vert      # Sprite billboard vertex shader
│   │   └── sprite.frag      # Sprite fragment shader (with fog)
│   └── index.ts             # Core module exports
├── editor/
│   └── TrackEditor.ts       # Track editor with 2D/3D views
├── sprites/
│   ├── SpriteRegistry.ts    # Sprite definitions and metadata
│   ├── spritesheet-data.ts  # Generated sprite atlas coordinates
│   ├── types.ts             # Sprite type definitions
│   └── index.ts             # Sprite module exports
├── config/
│   ├── constants.ts         # Game configuration values
│   └── colors.ts            # Color definitions (RGB)
├── data/
│   └── TrackData.ts         # Track serialization and persistence
├── types/
│   └── game.ts              # Core game type definitions
└── main.ts                  # Application entry point
```

### WebGL Renderer

The `WebGLRenderer` class handles all GPU rendering:

**Shader Programs:**
- `skyProgram` - Renders vertical gradient sky using uniform color array
- `roadProgram` - Renders road geometry with per-vertex colors and fog blending
- `spriteProgram` - Renders textured sprite quads with alpha and fog opacity

**Key Features:**
- Pre-allocated typed arrays for dynamic geometry (avoids GC pressure)
- Single sprite sheet texture atlas (2048x2048)
- Orthographic projection for 2D screen-space rendering
- NEAREST texture filtering for retro pixelated look
- Linear fog blending in fragment shaders

**Render Flow:**
1. Clear framebuffer
2. Draw sky gradient (fullscreen quad)
3. Project all visible segments (CPU-side perspective math)
4. Build road geometry (grass, rumble, road, lanes as triangles)
5. Upload and draw road in single draw call
6. Build sprite geometry back-to-front for proper depth ordering
7. Upload and draw sprites
8. Draw player car
9. Blit retro canvas to display canvas with upscaling

### Track System

Tracks are defined as a sequence of pieces:
- **Straight** - Flat road sections
- **Curve** - Left/right turns with configurable intensity
- **Hill** - Elevation changes with enter/hold/exit pattern

Each piece generates multiple road segments. Sprites can be placed at any segment with a lateral offset.

### Configuration

Key settings in `src/config/constants.ts`:
- `RENDER.RETRO_WIDTH/HEIGHT` - Internal resolution (512x384)
- `RENDER.DRAW_DISTANCE` - Visible segment count (300)
- `CAMERA.DEPTH` - Perspective factor (0.84)
- `CAMERA.ROAD_WIDTH` - Road width in world units (2000)
- `FOG.DEFAULT_DENSITY` - Fog intensity (5)

## Development

### Prerequisites

- Node.js 18+
- npm

### Setup

```bash
npm install
```

### Development Server

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Project Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Type check and build for production
- `npm run preview` - Preview production build

## Controls

### Game
- **Arrow Up** - Accelerate
- **Arrow Down** - Brake
- **Arrow Left/Right** - Steer
- **Escape** - Return to editor

### Editor
- **Scroll** - Zoom in/out
- **Drag** - Pan view
- **Click track** - Place sprite
- **Click sprite** - Select/edit sprite

## License

MIT
