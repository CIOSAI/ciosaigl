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
  constructor (webgl:WebGL2RenderingContext) {
    this.gl = webgl;
    this.util = new Util(webgl);
    this.basicProgram = this.util.createProgram(Shaders.vbasic, Shaders.fbasic);
    this.desiredFrameRate = 60 +10;
    this.running = false;
    this.backgroundRect;
  }

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

  stop () {
    this.running = false;
  }

  xform (matrix:number[]) {
    this.util.setUniform(this.basicProgram, 'mat4', 'xform', matrix.flat());
  }

  color (vec4:number[]) {
    this.util.setUniform(this.basicProgram, 'vec4', 'color', vec4);
  }

/**
  * when using sampler2D, value[0] is your framebuffer, value[1] is the texture slot
  * prefer using getNamedTextureSlot("coolShader-inputA"), but feel free to use any positive integer, stay away from 0 if possible
  */
  setUniform (program:WebGLProgram, list:{type:GLSLTypeString,key:string,value:number[]}[]) {
    for (let item of list) {
      this.util.setUniform(program, item.type, item.key, item.value);
    }
  }

  initFb ({_width = 16, _height = 16, _format = ImageFormat.RGBA}) {
    return this.util.pushTexture({_width: _width, _height: _height, _format: _format});
  }

  useFb (ind=-1) {
    this.util.setFb(ind);
  }

  getFb (ind:number) {
    this.util.getFb(ind);
  }

  // it is indeed 1 higher, due to texture0 being designated as undefined
  getNamedTextureSlot(name:string) {
    let searchAttempt = this.textureSlotNames.indexOf(name);
    if (searchAttempt===-1) {
      this.textureSlotNames.push(name);
      return this.textureSlotNames.length;
    }
    else {
      return searchAttempt+1;
    }
  }

  freeNamedTextureSlot(name:string) {
    let searchAttempt = this.textureSlotNames.indexOf(name);
    if (searchAttempt===-1) {
      console.warn(`there is no texture slot named '${name}', nothing freed`);
    }
    else {
      this.textureSlotNames.splice(searchAttempt, 1);
    }
  }

  initShader (fShader:string, vShader=Shaders.vbasic) {
    return this.util.createProgram(vShader, fShader, false);
  }

  initShape (vertices:number[][], program=this.basicProgram) {
    return this.util.pushVerts(program, vertices.flat(), vertices.length);
  }

  modifyShape (shape:ShapeWrap, vertices:number[][], program=this.basicProgram) {
    this.util.replaceVerts(program, vertices.flat(), shape);
    return shape;
  }

  drawShape (shape:ShapeWrap, program=this.basicProgram) {
    this.util.flush(program, shape);
  }

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
