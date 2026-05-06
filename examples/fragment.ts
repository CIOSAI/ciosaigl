import { CiosaiGL, Shapes } from "../main.ts";

export function fragmentExample() {
  let canvas = document.createElement('canvas') as HTMLCanvasElement;
  canvas.width = 1920; canvas.height = 1080;
  canvas.style.width = '100lvw'; canvas.style.height = '100lvh';
  let context = canvas.getContext('webgl2', {premultipliedAlpha: false});
  if (!context) { console.warn('context fail'); return; }
  let ciosai = new CiosaiGL(context);

  let res = [1920, 1080];
  let rect = ciosai.initShape(new Shapes().rect());
  let myShader = ciosai.initShader(
`
uniform vec2 res;
uniform float time;

void main() {
  vec2 uv = gl_FragCoord.xy/res;
  uv -= 0.5;
  uv *= vec2(res.x/res.y, 1.0);

  FragColor = vec4(sin(vec3(0.,2.,4.)+length(uv)*8.+time)*0.5+0.5, 1.0);
}
`);

  ciosai.run((time:number)=>{
    ciosai.setUniform(myShader, [
      {type: "vec2", key: "res", value: res},
      {type: "float", key: "time", value: [time]},
    ]);
    ciosai.drawShape(rect, myShader);
  });

  document.body.appendChild(canvas);
};
