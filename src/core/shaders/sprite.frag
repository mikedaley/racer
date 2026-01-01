#version 300 es
precision mediump float;

// Sprite fragment shader
// Samples texture with alpha and applies fog via opacity

in vec2 v_uv;
in float v_opacity;

out vec4 fragColor;

uniform sampler2D u_texture;

void main() {
    vec4 texColor = texture(u_texture, v_uv);

    // Discard fully transparent pixels
    if (texColor.a < 0.01) {
        discard;
    }

    // Apply fog via opacity
    fragColor = vec4(texColor.rgb, texColor.a * v_opacity);
}
