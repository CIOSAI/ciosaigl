import {vbasic} from "./globalGlsl.ts";
import * as Trans from "./matrix.ts";

const TAU = 6.2831853071;
const PI = TAU/2.0;

class Shapes {
  prec:number;
  constructor (precision=64) {
    this.prec = precision;
  }

  circle ({innerRadius=0}) {
    let innerRad = innerRadius;
    
    let vertices:number[][] = [];
    for (let i=-2; i<this.prec; i++) {
      if (i<0) {
	vertices.push([[1,0,0], [innerRad,0,0]][i+2]);
      }
      else {
	let amplitude = i%2==0?1:innerRad; // zigzagging
	let x = (1+i)/this.prec;
	vertices.push([Math.cos(x*TAU)*amplitude, Math.sin(x*TAU)*amplitude, 0]); 
      }
    }
    vertices.push(vertices[0]);

    return vertices;
  }

  rect () {
    return [[-1,-1,0],[-1,1,0],[1,-1,0],[1,1,0]];
  }

  capsule ({_a=[-1,0,0], _b=[1,0,0], _radius=0.1}) {
    let a = _a;
    let b = _b;
    let radius = _radius;
    
    let rings = Math.floor(Math.sqrt(this.prec));
    let ringDetail = Math.floor(Math.sqrt(this.prec));
    let vertices:number[][] = [];

    let len = (v:number[]) => Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]);
    let nor = (v:number[]) => {
      let l = len(v);
      return [v[0]/l, v[1]/l, v[2]/l];
    };
    let cross = (v1:number[], v2:number[]) => {
      return [
	v1[1]*v2[2] - v1[2]*v2[1],
	v1[2]*v2[0] - v1[0]*v2[2],
	v1[0]*v2[1] - v1[1]*v2[0],
      ];
    };
    let d = nor([b[0]-a[0], b[1]-a[1], b[2]-a[2]]);
    let e = nor(cross(d, [1,0,0]));
    let f = nor(cross(e, d));
    let lookat = [...d, 0, ...e, 0, ...f, 0, 0, 0, 0, 1];

    for (let i=0; i<rings; i++) {
      for (let j=0; j<ringDetail; j++) {
	let tr = Trans.multAll([
	  Trans.xlate(a[0], a[1], a[2]),
	  Trans.scale(radius, radius, radius),
	  lookat,
	  Trans.rotX(TAU*j/ringDetail),
	]);
	let v = [0, 0, 0];

	v = [Math.cos(PI+PI*0.5*i/rings),
	     Math.sin(PI*0.5*i/rings), 0];
	v = Trans.apply(tr, v);
	vertices.push(v);
	
	v = [Math.cos(PI+PI*0.5*(i+1)/rings),
	     Math.sin(PI*0.5*(i+1)/rings), 0];
	v = Trans.apply(tr, v);
	vertices.push(v);
      }
    }
    for (let j=0; j<ringDetail; j++) {
      let ang = TAU*j/ringDetail;

      vertices.push(Trans.apply(
	Trans.multAll([Trans.xlate(a[0], a[1], a[2]), lookat]),
	[0, Math.cos(ang)*radius, Math.sin(ang)*radius]
      ));
      vertices.push(Trans.apply(
	Trans.multAll([Trans.xlate(b[0], b[1], b[2]), lookat]),
	[0, Math.cos(ang)*radius, Math.sin(ang)*radius]
      ));
    }
    for (let i=rings; i>0; i-=1) {
      for (let j=0; j<ringDetail; j++) {
	let tr = Trans.multAll([
	  Trans.xlate(b[0], b[1], b[2]),
	  Trans.scale(radius, radius, radius),
	  lookat,
	  Trans.rotX(TAU*j/ringDetail),
	]);
	let v = [0, 0, 0];

	v = [Math.cos(PI*0.5*i/rings),
	     Math.sin(PI*0.5*i/rings), 0];
	v = Trans.apply(tr, v);
	vertices.push(v);
	
	v = [Math.cos(PI*0.5*(i-1)/rings),
	     Math.sin(PI*0.5*(i-1)/rings), 0];
	v = Trans.apply(tr, v);
	vertices.push(v);
      }
    }

    return vertices;
  }
}

enum ImageFormat {
  RGB = 6407,
  RGBA = 6408,
  RGBA32F = 34836,
}

enum ChannelFormat {
  UNSIGNED_BYTE = 5121,
  FLOAT = 5126,
}

type GLSLTypeString = 'float'|'int'|'vec2'|'vec3'|'vec4'|'ivec2'|'ivec3'|'ivec4'|'mat2'|'mat3'|'mat4'|'sampler2D';

interface FramebufferWrap {
  fb:WebGLFramebuffer;
  width:number;
  height:number;
  format:ImageFormat;
  texture:WebGLTexture;
}

/**
  * @prop {number} index position where the vertices start at
  * @prop {number} amount of triangles this shape uses
  */ 
interface ShapeWrap {
  loc:number;
  tri:number;
}

class Util {
  gl:WebGL2RenderingContext;
  GL_TEXTURE_0 = 33984;
  aVertexPositionLoc = 0;
  vertPrefix = `#version 300 es\nlayout(location = ${this.aVertexPositionLoc}) in vec3 aVertexPosition;\n`;
  fragPrefix = `#version 300 es\nprecision mediump float;\n#define PI acos(-1.)\n#define TAU (PI*2.)\nout vec4 FragColor;\n`;
  vertBf:WebGLBuffer;
  vertBfEnd = 0;
  fbs:FramebufferWrap[] = [];

  constructor (gl:WebGL2RenderingContext) {
    this.gl = gl;
    this.gl.getExtension('EXT_color_buffer_float');

    this.vertBf = this.gl.createBuffer();

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertBf);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(1<<20), this.gl.STATIC_DRAW);
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);
  }

  createProgram (vcode:string, fcode:string, mainProgram=true) {
    let program:WebGLProgram;
    let vert = this.gl.createShader(this.gl.VERTEX_SHADER);
    if (vert) {
      this.gl.shaderSource(vert, `${this.vertPrefix}${vcode}`);
      this.gl.compileShader(vert);
    }
    else {
      console.warn(`issue with vertex shader, source:\n${vcode}`);
    }
    let frag = this.gl.createShader(this.gl.FRAGMENT_SHADER);
    if (frag) {
      this.gl.shaderSource(frag, `${this.fragPrefix}${fcode}`);
      this.gl.compileShader(frag);
    }
    else {
      console.warn(`issue with fragment shader, source:\n${vcode}`);
    }

    program = this.gl.createProgram();
    if (vert) this.gl.attachShader(program, vert);
    if (frag) this.gl.attachShader(program, frag);
    this.gl.linkProgram(program);

    if (mainProgram) {
      this.gl.disable(this.gl.DEPTH_TEST);
    }

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertBf);
    this.gl.enableVertexAttribArray(this.aVertexPositionLoc);
    this.gl.vertexAttribPointer(this.aVertexPositionLoc, 3, this.gl.FLOAT, false, 0, 0);

    // if vertex code didn't change, at least provide an identify transform
    if (vcode===vbasic) {
      this.setUniform(program, "mat4", "xform", Trans.identity);
    }

    return program;
  }
  
  pushTexture ({_width = 16, _height = 16, _format = ImageFormat.RGBA}) {
    let width = _width;
    let height = _height;
    let format = _format;
    let componentFormat = ImageFormat.RGBA;
    let componentType:ChannelFormat = ChannelFormat.UNSIGNED_BYTE;
    let componentPerPixel = 4;
    let arrayConstructor:(size:number)=>Float32Array|Uint8Array = (size:number) => new Uint8Array(size);

    if (format===ImageFormat.RGB) {componentPerPixel = 3;}
    if (format===ImageFormat.RGBA32F) {
      componentType = ChannelFormat.FLOAT;
      arrayConstructor = (size) => new Float32Array(size);
    }

    let fb = this.gl.createFramebuffer();
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, fb);
    let tex = this.gl.createTexture();
    this.gl.bindTexture(this.gl.TEXTURE_2D, tex);
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, format, width, height, 
                       0, componentFormat, componentType, arrayConstructor(width*height*componentPerPixel));
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);

    this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER, this.gl.COLOR_ATTACHMENT0, this.gl.TEXTURE_2D, tex, 0);

    this.gl.bindTexture(this.gl.TEXTURE_2D, null);
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);

    let ind = this.fbs.length;
    this.fbs.push({fb: fb, width: width, height: height, format: format, texture: tex});
    return ind;
  }

  setFb (who=-1) {
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, who<0?null:this.fbs[who].fb);
    this.gl.viewport(0,0,who<0?1920:this.fbs[who].width,who<0?1080:this.fbs[who].height);
  }

  getFb (who:number) {
    return this.fbs[who];
  }

  getTextureSlotEnum (index:number) {
    let maximum = this.gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS;
    if (index<0) {
      console.warn(`attempted to use negative texture slot of ${index}, defaulted to 0th`);
      return this.GL_TEXTURE_0;
    }
    if (index>=maximum) {
      console.warn(`sorry, this device only has ${maximum} image slots. you attempted to use the ${index}th. defaulted to 0th`);
      return this.GL_TEXTURE_0;
    }
    return this.GL_TEXTURE_0+index;
  }

  pushVerts (_program:WebGLProgram, floatArray:number[], triangleCnt: number): ShapeWrap {
    let f32arr = new Float32Array(floatArray);
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertBf);
    this.gl.bufferSubData(this.gl.ARRAY_BUFFER, this.vertBfEnd, f32arr);
    let shapeLoc = this.vertBfEnd;
    this.vertBfEnd += f32arr.byteLength;
    return  {loc: shapeLoc, tri: triangleCnt};
  }

  replaceVerts (_program:WebGLProgram, floatArray:number[], shape:ShapeWrap) {
    let f32arr = new Float32Array(floatArray);
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertBf);
    this.gl.bufferSubData(this.gl.ARRAY_BUFFER, shape.loc, f32arr);
  }

  flush (program:WebGLProgram, uploadedShape:ShapeWrap) {
    this.gl.useProgram(program);
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertBf);
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, uploadedShape.loc/3/4, uploadedShape.tri);

    // for sampler2D uniforms, they can't get reset before drawing, so resetting them here
    this.gl.bindTexture(this.gl.TEXTURE_2D, null);
    this.gl.activeTexture(this.GL_TEXTURE_0);
  }

  setUniform (program:WebGLProgram, type: GLSLTypeString, key:string, value:number[]) {
    this.gl.useProgram(program);
    let loc = this.gl.getUniformLocation(program, key);
    if (!loc) { console.warn(`attempted to set non-existent uniform '${key}'`); }
    let matchVec = type.match(/^vec([2-4])$/);
    let matchIvec = type.match(/^ivec([2-4])$/);
    let matchMat = type.match(/^mat([2-4])$/);
    if (type==='float') {
      this.gl.uniform1fv(loc, new Float32Array(value));
    }
    else if (type==='int') {
      this.gl.uniform1iv(loc, new Int32Array(value));
    }
    else if (matchVec) {
      this.gl[`uniform${matchVec[1]}fv`](loc, new Float32Array(value));
    }
    else if (matchIvec) {
      this.gl[`uniform${matchIvec[1]}iv`](loc, new Int32Array(value));
    }
    else if (matchMat) {
      this.gl[`uniformMatrix${matchMat[1]}fv`](loc, false, new Float32Array(value));
    }
    else if (type==='sampler2D') {
      // 0th slot is being used as a fallback
      if (value.length<2) {
	console.warn(`data missing for sampler2D ${key}
value[0] is the framebuffer that holds the input data
value[1] is the texture slot to put it in
data that was provided:
${value}
`);
	return;
      }
      if (value[0]>=this.fbs.length) {
	console.warn(`attempted to index a non-existent framebuffer of index ${value[0]} for sampler2D ${key}`);
	return;
      }
      let inputFb = this.getFb(value[0]);
      let slotEnum = this.getTextureSlotEnum(value[1]);
      this.gl.activeTexture(slotEnum);
      this.gl.bindTexture(this.gl.TEXTURE_2D, inputFb.texture);
      this.gl.uniform1i(loc, slotEnum===this.GL_TEXTURE_0?0:value[1]);
    }
    else {
      console.warn(`unidentified type : ${type}, try float, int, vec or mat`);
    }
  }

  showAttributes (program:WebGLProgram) {
    let o = '';
    let n = this.gl.getProgramParameter(program, this.gl.ACTIVE_ATTRIBUTES)
    for (let i=0; i<n; i++) {
      let info = this.gl.getActiveAttrib(program, i);
      if (!info) continue;
      o+=`name: ${info.name}\ttype: ${info.type}\tsize: ${info.size}\n`;
    }
    console.log(o);
  }

  showUniforms (program:WebGLProgram) {
    let o = '';
    let n = this.gl.getProgramParameter(program, this.gl.ACTIVE_UNIFORMS)
    for (let i=0; i<n; i++) {
      let info = this.gl.getActiveUniform(program, i);
      if (!info) continue;
      o+=`name: ${info.name}\ttype: ${info.type}\tsize: ${info.size}\n`;
    }
    console.log(o);
  }
}

export { Shapes, Util, ImageFormat, ShapeWrap, GLSLTypeString, PI, TAU }
