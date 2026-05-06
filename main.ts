import * as Shaders from './src/globalGlsl.ts';
import * as Trans from './src/matrix.ts';
import { Shapes, Util, ImageFormat, ShapeWrap, GLSLTypeString } from './src/util.ts';

class CiosaiGL {
  gl:WebGL2RenderingContext;
  util:Util;
  basicProgram:WebGLShader;
  desiredFrameRate:number;
  running:boolean;
  backgroundRect:ShapeWrap;
  textureSlotNames:string[] = [];

  /**
   * feed webgl2 manually by doing 
   * `canvas.getContext('webgl2', {premultipliedAlpha: false})`
   * 
   * \* note: it is recommended to turn off premultipliedAlpha to avoid 
   * getting unwanted blending between canvas and its background
   */
  constructor (webgl:WebGL2RenderingContext) {
    this.gl = webgl;
    this.util = new Util(webgl);
    this.basicProgram = this.util.createProgram(Shaders.vbasic, Shaders.fbasic);
    this.desiredFrameRate = 60 +10;
    this.running = false;
    this.backgroundRect;
  }

  /**
   * process will be ran 60 times a second if possible
   */
  run (process:(time:number)=>void, oneFrame = false) {
    let lastTime = Date.now();
    let render = (now:number /* this is since the page was opened */) => {
      if (this.running) {
	requestAnimationFrame(render);
      }

      let noww = Date.now(); // this is in unix
      let elapsed = (noww-lastTime)/1000;
      if (this.desiredFrameRate>0) {
	if (elapsed>1.0/this.desiredFrameRate) {
	  process(now/1000);
	  lastTime = noww - (elapsed%(1.0/this.desiredFrameRate));
	}
      }
      else {
	process(now/1000);
	lastTime = noww;
      }
      //console.log(`frameRate : ${1.0 / Math.max(0.0000001, elapsed)}`);
    }
    if (oneFrame) {
      this.running = false;
      requestAnimationFrame(render);
    }
    else {
      this.running = true;
      requestAnimationFrame(render);
    }
  }

  /**
   * manually pause the animation
   */
  stop () {
    this.running = false;
  }

  /**
   * ONLY WORKS FOR THE DEFAULT SHADER
   * for other custom shaders, please set it just like other uniforms
   * `setUniform(myShader, [{type: "mat4", key: "xform", value: Trans.identity}, ...])`
   */
  xform (matrix:number[]) {
    this.util.setUniform(this.basicProgram, 'mat4', 'xform', matrix.flat());
  }

  /**
   * ONLY WORKS FOR THE DEFAULT SHADER
   * for other custom shaders, please set it just like other uniforms
   * `setUniform(myShader, [{type: "vec4", key: "color", value: [1,1,1,1]}, ...])`
   */
  color (vec4:number[]) {
    this.util.setUniform(this.basicProgram, 'vec4', 'color', vec4);
  }

  /**
    * when using sampler2D, value[0] is your framebuffer, value[1] is the texture slot
    * prefer using getNamedTextureSlot("coolShader-inputA"), but feel free to use 
    * any positive integer, stay away from 0 if possible
    */
  setUniform (program:WebGLProgram, list:{type:GLSLTypeString,key:string,value:number[]}[]) {
    for (let item of list) {
      this.util.setUniform(program, item.type, item.key, item.value);
    }
  }

  /**
    * create an image
    * \* note: oversimplified, it's not the image
    */
  initFb ({_width = 16, _height = 16, _format = ImageFormat.RGBA}) {
    return this.util.pushTexture({_width: _width, _height: _height, _format: _format});
  }

  /**
    * choose which image to draw onto
    * -1 sets it to the canvas image, this will show up on the screen
    */
  useFb (ind=-1) {
    this.util.setFb(ind);
  }

  /**
    * when using sampler2D uniforms, we need to tell webgl which "texture unit" to 
    * use for passing these data, the texture units are indexed with integers,
    * it quickly gets confusing
    *
    * this is a simple utility to just get whichever available
    */
  getNamedTextureSlot(name:string) {
    // it is indeed 1 higher, due to texture0 being designated as undefined
    let searchAttempt = this.textureSlotNames.indexOf(name);
    if (searchAttempt===-1) {
      this.textureSlotNames.push(name);
      return this.textureSlotNames.length;
    }
    else {
      return searchAttempt+1;
    }
  }

  /**
    * this tells ciosaiGL that you are not using the "texture unit" anymore, and
    * something else and use it
    */
  freeNamedTextureSlot(name:string) {
    let searchAttempt = this.textureSlotNames.indexOf(name);
    if (searchAttempt===-1) {
      console.warn(`there is no texture slot named '${name}', nothing freed`);
    }
    else {
      this.textureSlotNames.splice(searchAttempt, 1);
    }
  }

  /**
    * there are fbasic and vbasic from `./src/globalGlsl` when you aren't customizing anything
    */
  initShader (fShader:string, vShader=Shaders.vbasic) {
    return this.util.createProgram(vShader, fShader, false);
  }

  /**
    * a shape must be created in order to be drawn
    * \* note: it just pushes the vertex data to buffer
    */
  initShape (vertices:number[][], program=this.basicProgram) {
    return this.util.pushVerts(program, vertices.flat(), vertices.length);
  }

  /**
    * for updating an existing shape
    * it's recommended to use vertex shader or transform for most operations
    */
  modifyShape (shape:ShapeWrap, vertices:number[][], program=this.basicProgram) {
    this.util.replaceVerts(program, vertices.flat(), shape);
    return shape;
  }

  /**
   * puts the thing in the image(Fb)
   */
  drawShape (shape:ShapeWrap, program=this.basicProgram) {
    this.util.flush(program, shape);
  }

  /**
   * fill with solid color
   */
  background (vec4:number[]) {
    this.xform(Trans.identity);
    this.color(vec4);
    if (!this.backgroundRect) {
      this.backgroundRect = this.initShape((new Shapes()).rect());
    }
    this.drawShape(this.backgroundRect);
  }
}

export {CiosaiGL, Shapes, Trans, Shaders};
