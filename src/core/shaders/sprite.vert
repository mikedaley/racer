#version 300 es

// Sprite billboard vertex shader
// Renders textured quads for roadside sprites and player car

in vec2 a_position;
in vec2 a_uv;
in float a_opacity;

out vec2 v_uv;
out float v_opacity;

uniform mat4 u_projection;

void main() {
    v_uv = a_uv;
    v_opacity = a_opacity;
    gl_Position = u_projection * vec4(a_position, 0.0, 1.0);
}
