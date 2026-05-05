export const vbasic = `
uniform mat4 xform;

void main() {
    gl_Position = xform*vec4(aVertexPosition,1);
    gl_Position.z /= 999.;
}
`;
export const fbasic = `
uniform vec4 color;

void main() {
    FragColor = color;
}
`
export const fdebug = `
void main() {
    FragColor = vec4(gl_FragCoord.xy/vec2(1920.,1080.), 0, 1);
}
`
