#version 300 es

// Road segment vertex shader
// Renders quads for road surfaces, grass, rumble strips, and lane markers

in vec2 a_position;
in vec3 a_color;
in float a_fogAmount;

out vec3 v_color;
out float v_fogAmount;

uniform mat4 u_projection;

void main() {
    v_color = a_color;
    v_fogAmount = a_fogAmount;
    gl_Position = u_projection * vec4(a_position, 0.0, 1.0);
}
