import { CiosaiGL, Shapes } from "../main.ts";

export function feedbackExample () {
  let canvas = document.createElement('canvas') as HTMLCanvasElement;
  canvas.width = 1920; canvas.height = 1080;
  canvas.style.width = '100lvw'; canvas.style.height = '100lvh';
  let context = canvas.getContext('webgl2', {premultipliedAlpha: false});
  if (!context) { console.warn('context fail'); return; }
  let ciosai = new CiosaiGL(context);

  let res = [1920, 1080];
  let rect = ciosai.initShape(new Shapes().rect());
  let feedbackShader = ciosai.initShader(
`
uniform vec2 res;
uniform float drawCircle;
uniform sampler2D prev;

void main() {
  vec2 uv = gl_FragCoord.xy/res;
  float ra = 5.0;

  vec4 blur = 
    texture(prev, (gl_FragCoord.xy+vec2( 0.,-ra))/res)/5.+
    texture(prev, (gl_FragCoord.xy+vec2(-ra, 0.))/res)/5.+
    texture(prev, (gl_FragCoord.xy+vec2( 0., 0.))/res)/5.+
    texture(prev, (gl_FragCoord.xy+vec2( ra, 0.))/res)/5.+
    texture(prev, (gl_FragCoord.xy+vec2( 0., ra))/res)/5.
  ;

  FragColor = vec4(pow(blur.rgb,vec3(0.99)),1.0);
  FragColor.rgb += vec3(step(max(abs(uv.x-0.5), abs(uv.y-0.5)), 0.1))*drawCircle;
}
`);
  let fbsPingpong = [
    ciosai.initFb({_width: res[0], _height: res[1]}),
    ciosai.initFb({_width: res[0], _height: res[1]})
  ];
  let idxPingpong = 0;
  let presentShader = ciosai.initShader(
`
uniform vec2 res;
uniform sampler2D image;

void main() {
  vec2 uv = gl_FragCoord.xy/res;
  FragColor = texture(image, uv);
}
`);

  // draw the initial box
  ciosai.useFb(fbsPingpong[1-idxPingpong]);
  ciosai.setUniform(feedbackShader, [
    { type: "vec2", key: "res", value: res },
    { type: "float", key: "drawCircle", value: [1] },
    { type: "sampler2D", key: "prev", value: [fbsPingpong[idxPingpong], ciosai.getNamedTextureSlot("feedback")] },
  ]);
  ciosai.drawShape(rect, feedbackShader);

  ciosai.run((time:number)=>{
    // choose one of our two hidden images
    ciosai.useFb(fbsPingpong[idxPingpong]);
    ciosai.setUniform(feedbackShader, [
      { type: "vec2", key: "res", value: res },
      { type: "float", key: "drawCircle", value: [0] },
      { type: "sampler2D", key: "prev", value: [fbsPingpong[1-idxPingpong], ciosai.getNamedTextureSlot("feedback")] },
    ]);
    // applying shader
    ciosai.drawShape(rect, feedbackShader);
    // flipping between the two images for next frame
    idxPingpong = 1-idxPingpong;

    // choose the main framebuffer (the canvas)
    ciosai.useFb(-1);
    ciosai.setUniform(presentShader, [
      { type: "vec2", key: "res", value: res },
      { type: "sampler2D", key: "image", value: [fbsPingpong[1-idxPingpong], ciosai.getNamedTextureSlot("present")] },
    ]);
    // show the feedback shader result to the screen
    ciosai.drawShape(rect, presentShader);
  });

  document.body.appendChild(canvas);
};
