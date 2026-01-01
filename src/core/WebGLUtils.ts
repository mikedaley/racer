/**
 * WebGL Utility Functions
 * Shader compilation and buffer management helpers
 */

/**
 * Compile a shader from source
 */
export function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error("Failed to create shader");
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compilation error: ${info}`);
  }

  return shader;
}

/**
 * Create a shader program from vertex and fragment shader sources
 */
export function createProgram(
  gl: WebGL2RenderingContext,
  vertexSource: string,
  fragmentSource: string
): WebGLProgram {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);

  const program = gl.createProgram();
  if (!program) {
    throw new Error("Failed to create program");
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Program linking error: ${info}`);
  }

  // Clean up shaders after linking
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  return program;
}

/**
 * Create a buffer and upload data
 */
export function createBuffer(
  gl: WebGL2RenderingContext,
  data: Float32Array | Uint16Array,
  target: number = gl.ARRAY_BUFFER,
  usage: number = gl.STATIC_DRAW
): WebGLBuffer {
  const buffer = gl.createBuffer();
  if (!buffer) {
    throw new Error("Failed to create buffer");
  }

  gl.bindBuffer(target, buffer);
  gl.bufferData(target, data, usage);

  return buffer;
}

/**
 * Create a texture from an image
 */
export function createTexture(
  gl: WebGL2RenderingContext,
  image: HTMLImageElement,
  options: {
    filter?: number;
    wrap?: number;
  } = {}
): WebGLTexture {
  const texture = gl.createTexture();
  if (!texture) {
    throw new Error("Failed to create texture");
  }

  const filter = options.filter ?? gl.NEAREST;
  const wrap = options.wrap ?? gl.CLAMP_TO_EDGE;

  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);

  return texture;
}

/**
 * Get uniform locations for a program
 */
export function getUniformLocations<T extends string>(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  names: T[]
): Record<T, WebGLUniformLocation | null> {
  const locations: Partial<Record<T, WebGLUniformLocation | null>> = {};
  for (const name of names) {
    locations[name] = gl.getUniformLocation(program, name);
  }
  return locations as Record<T, WebGLUniformLocation | null>;
}

/**
 * Get attribute locations for a program
 */
export function getAttribLocations<T extends string>(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  names: T[]
): Record<T, number> {
  const locations: Partial<Record<T, number>> = {};
  for (const name of names) {
    locations[name] = gl.getAttribLocation(program, name);
  }
  return locations as Record<T, number>;
}

/**
 * Create a Vertex Array Object with attribute bindings
 */
export function createVAO(
  gl: WebGL2RenderingContext,
  attributes: Array<{
    buffer: WebGLBuffer;
    location: number;
    size: number;
    type?: number;
    normalized?: boolean;
    stride?: number;
    offset?: number;
  }>,
  indexBuffer?: WebGLBuffer
): WebGLVertexArrayObject {
  const vao = gl.createVertexArray();
  if (!vao) {
    throw new Error("Failed to create VAO");
  }

  gl.bindVertexArray(vao);

  for (const attr of attributes) {
    gl.bindBuffer(gl.ARRAY_BUFFER, attr.buffer);
    gl.enableVertexAttribArray(attr.location);
    gl.vertexAttribPointer(
      attr.location,
      attr.size,
      attr.type ?? gl.FLOAT,
      attr.normalized ?? false,
      attr.stride ?? 0,
      attr.offset ?? 0
    );
  }

  if (indexBuffer) {
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  }

  gl.bindVertexArray(null);

  return vao;
}

/**
 * Create an orthographic projection matrix
 */
export function ortho(
  left: number,
  right: number,
  bottom: number,
  top: number,
  near: number,
  far: number
): Float32Array {
  const out = new Float32Array(16);
  const lr = 1 / (left - right);
  const bt = 1 / (bottom - top);
  const nf = 1 / (near - far);

  out[0] = -2 * lr;
  out[1] = 0;
  out[2] = 0;
  out[3] = 0;
  out[4] = 0;
  out[5] = -2 * bt;
  out[6] = 0;
  out[7] = 0;
  out[8] = 0;
  out[9] = 0;
  out[10] = 2 * nf;
  out[11] = 0;
  out[12] = (left + right) * lr;
  out[13] = (top + bottom) * bt;
  out[14] = (far + near) * nf;
  out[15] = 1;

  return out;
}

/**
 * Create an identity matrix
 */
export function identity(): Float32Array {
  const out = new Float32Array(16);
  out[0] = 1;
  out[5] = 1;
  out[10] = 1;
  out[15] = 1;
  return out;
}
