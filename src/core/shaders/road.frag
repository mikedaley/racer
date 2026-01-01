#version 300 es
precision mediump float;

// Road segment fragment shader
// Applies fog blending to road colors

in vec3 v_color;
in float v_fogAmount;

out vec4 fragColor;

uniform vec3 u_fogColor;

void main() {
    vec3 color = mix(v_color, u_fogColor, v_fogAmount);
    fragColor = vec4(color, 1.0);
}
