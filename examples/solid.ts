import { CiosaiGL, Shapes, Trans } from "../main.ts";

export function solidExample() {
  let canvas = document.createElement('canvas') as HTMLCanvasElement;
  canvas.width = 1920; canvas.height = 1080;
  canvas.style.width = '100lvw'; canvas.style.height = '100lvh';
  let context = canvas.getContext('webgl2', {premultipliedAlpha: false});
  if (!context) { console.warn('context fail'); return; }
  let ciosai = new CiosaiGL(context);

  let circle = ciosai.initShape(new Shapes().circle({innerRadius: 0.3}));

  ciosai.run((time:number)=>{
    ciosai.color([Math.sin(time)*0.5+0.5, 0, 0, 1]);
    ciosai.xform(Trans.scale(9/16,1,1));
    ciosai.drawShape(circle);
  });

  document.body.appendChild(canvas);
};
