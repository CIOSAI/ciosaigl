import { CiosaiGL, Shapes, Trans } from "../main.ts";
import { fbasic } from "../src/globalGlsl.ts";

export function vertexExample() {
  let canvas = document.createElement('canvas') as HTMLCanvasElement;
  canvas.width = 1920; canvas.height = 1080;
  canvas.style.width = '100lvw'; canvas.style.height = '100lvh';
  let context = canvas.getContext('webgl2', {premultipliedAlpha: false});
  if (!context) { console.warn('context fail'); return; }
  let ciosai = new CiosaiGL(context);

  let circle = ciosai.initShape(new Shapes(128).circle({innerRadius: 0.3}));

  let myShader = ciosai.initShader(fbasic, 
`
uniform mat4 xform;
uniform float time;

void main() {
    gl_Position = xform*vec4(aVertexPosition,1);

    gl_Position.x += sin(gl_Position.y*8.+time*8.)*(pow(sin(time),3.)*0.5);

    gl_Position.z /= 999.;
}
`);

  ciosai.run((time:number)=>{
    ciosai.setUniform(myShader, [
      {type: "mat4", key: "xform", value: Trans.scale(9/16,1,1)},
      {type: "float", key: "time", value: [time]},
      {type: "vec4", key: "color", value: [0,0,0,1]},
    ]);
    ciosai.drawShape(circle, myShader);
  });

  document.body.appendChild(canvas);
};
