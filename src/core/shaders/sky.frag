#version 300 es
precision mediump float;

// Sky gradient fragment shader
// Renders vertical color bands for sunset sky effect

in vec2 v_uv;
out vec4 fragColor;

#define MAX_BANDS 20

uniform vec3 u_colors[MAX_BANDS];
uniform int u_bandCount;

void main() {
    // v_uv.y goes from 0 (bottom) to 1 (top)
    // We want top of screen to be first color (index 0)
    float t = 1.0 - v_uv.y;

    // Calculate which band we're in
    float bandSize = 1.0 / float(u_bandCount);
    int bandIndex = int(t / bandSize);

    // Clamp to valid range
    bandIndex = min(bandIndex, u_bandCount - 1);

    vec3 color = u_colors[bandIndex];
    fragColor = vec4(color, 1.0);
}
