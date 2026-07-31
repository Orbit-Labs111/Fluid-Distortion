import { useEffect, useRef, useState, type CSSProperties } from "react";

export interface LiquidHoverProps {
  imageSrc?: string;
  resolution?: number;
  cursorSize?: number;
  intensity?: number;
  style?: CSSProperties;
  className?: string;
  onImageError?: (err: string) => void;
}

export const DEFAULT_IMAGE =
  "https://images.unsplash.com/photo-1784571350701-f34a5c6d3cf4?q=80&w=626&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D";

export default function LiquidHover({
  imageSrc = DEFAULT_IMAGE,
  resolution = 10,
  cursorSize = 50,
  intensity = 50,
  style,
  className = "",
  onImageError,
}: LiquidHoverProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    
    const glMaybe = canvas.getContext("webgl", { alpha: true });
    if (!glMaybe) {
      setError("WebGL is not supported in this browser.");
      if (onImageError) onImageError("WebGL is not supported");
      return;
    }
    const gl: any = glMaybe;
    
    // Enable floating point texture extensions
    const extFloat = gl.getExtension("OES_texture_float");
    const extLinear = gl.getExtension("OES_texture_float_linear");
    if (!extFloat) {
      console.warn("OES_texture_float extension not supported, falling back.");
    }

    gl.clearColor(0, 0, 0, 0);

    const cp = intensity / 100;
    const params = {
      cursorRadiusPx: cursorSize,
      cursorPower: 5 + ((cp - 0.1) * (50 - 5)) / (1 - 0.1),
      distortionPower: intensity / 100,
    };
    const overscanFactor = 1.2;
    const innerScale = 5 / 6;
    const pointer = {
      x: 0.65 * (container.clientWidth || 400),
      y: 0.5 * (container.clientHeight || 500),
      dx: 0,
      dy: 0,
      moved: false,
    };
    const res = { w: 0, h: 0 };
    let outputColor: any;
    let velocity: any;
    let divergence: any;
    let pressure: any;
    let imageTexture: any = null;
    let imgRatio = 1;
    const isPreview = false;
    let isHovering = false;

    const VERT = `
precision highp float;

varying vec2 vUv;
attribute vec2 a_position;

varying vec2 vL;
varying vec2 vR;
varying vec2 vT;
varying vec2 vB;
uniform vec2 u_texel;

void main () {
  vUv = .5 * (a_position + 1.);
  vL = vUv - vec2(u_texel.x, 0.);
  vR = vUv + vec2(u_texel.x, 0.);
  vT = vUv + vec2(0., u_texel.y);
  vB = vUv - vec2(0., u_texel.y);
  gl_Position = vec4(a_position, 0., 1.);
}
`;
    const FRAG_ADVECT = `
precision highp float;
precision highp sampler2D;

varying vec2 vUv;
uniform sampler2D u_velocity_texture;
uniform sampler2D u_input_texture;
uniform vec2 u_texel;
uniform vec2 u_output_textel;
uniform float u_dt;
uniform float u_dissipation;

vec4 bilerp (sampler2D sam, vec2 uv, vec2 tsize) {
  vec2 st = uv / tsize - 0.5;
  vec2 iuv = floor(st);
  vec2 fuv = fract(st);
  vec4 a = texture2D(sam, (iuv + vec2(0.5, 0.5)) * tsize);
  vec4 b = texture2D(sam, (iuv + vec2(1.5, 0.5)) * tsize);
  vec4 c = texture2D(sam, (iuv + vec2(0.5, 1.5)) * tsize);
  vec4 d = texture2D(sam, (iuv + vec2(1.5, 1.5)) * tsize);
  return mix(mix(a, b, fuv.x), mix(c, d, fuv.x), fuv.y);
}

void main () {
  vec2 coord = vUv - u_dt * bilerp(u_velocity_texture, vUv, u_texel).xy * u_texel;
  vec4 velocity = bilerp(u_input_texture, coord, u_output_textel);
  gl_FragColor = u_dissipation * velocity;
}
`;
    const FRAG_DIVERGENCE = `
precision highp float;
precision highp sampler2D;

varying highp vec2 vUv;
varying highp vec2 vL;
varying highp vec2 vR;
varying highp vec2 vT;
varying highp vec2 vB;
uniform sampler2D u_velocity_texture;

void main () {
  float L = texture2D(u_velocity_texture, vL).x;
  float R = texture2D(u_velocity_texture, vR).x;
  float T = texture2D(u_velocity_texture, vT).y;
  float B = texture2D(u_velocity_texture, vB).y;
  float div = .25 * (R - L + T - B);
  gl_FragColor = vec4(div, 0., 0., 1.);
}
`;
    const FRAG_PRESSURE = `
precision highp float;
precision highp sampler2D;

varying highp vec2 vUv;
varying highp vec2 vL;
varying highp vec2 vR;
varying highp vec2 vT;
varying highp vec2 vB;
uniform sampler2D u_pressure_texture;
uniform sampler2D u_divergence_texture;

void main () {
  float L = texture2D(u_pressure_texture, vL).x;
  float R = texture2D(u_pressure_texture, vR).x;
  float T = texture2D(u_pressure_texture, vT).x;
  float B = texture2D(u_pressure_texture, vB).x;
  float divergence = texture2D(u_divergence_texture, vUv).x;
  float pressure = (L + R + B + T - divergence) * .25;
  gl_FragColor = vec4(pressure, 0., 0., 1.);
}
`;
    const FRAG_GRAD_SUB = `
precision highp float;
precision highp sampler2D;

varying highp vec2 vUv;
varying highp vec2 vL;
varying highp vec2 vR;
varying highp vec2 vT;
varying highp vec2 vB;
uniform sampler2D u_pressure_texture;
uniform sampler2D u_velocity_texture;

void main () {
  float L = texture2D(u_pressure_texture, vL).x;
  float R = texture2D(u_pressure_texture, vR).x;
  float T = texture2D(u_pressure_texture, vT).x;
  float B = texture2D(u_pressure_texture, vB).x;
  vec2 velocity = texture2D(u_velocity_texture, vUv).xy;
  velocity.xy -= vec2(R - L, T - B);
  gl_FragColor = vec4(velocity, 0., 1.);
}
`;
    const FRAG_POINT = `
precision highp float;
precision highp sampler2D;

varying vec2 vUv;
uniform sampler2D u_input_texture;
uniform float u_ratio;
uniform float u_img_ratio;
uniform vec3 u_point_value;
uniform vec2 u_point;
uniform float u_point_size;

void main () {
  vec2 p = vUv - u_point.xy;
  p.x *= u_ratio;
  vec3 splat = .6 * pow(2., -dot(p, p) / u_point_size) * u_point_value;
  vec3 base = texture2D(u_input_texture, vUv).xyz;
  gl_FragColor = vec4(base + splat, 1.);
}
`;
    const FRAG_OUTPUT = `
precision highp float;
precision highp sampler2D;

varying vec2 vUv;
uniform float u_ratio;
uniform float u_img_ratio;
uniform float u_disturb_power;
uniform sampler2D u_output_texture;
uniform sampler2D u_velocity_texture;
uniform sampler2D u_text_texture;
uniform vec2 u_point;
uniform float u_canvas_scale;
uniform float u_inner_scale;

vec2 get_img_uv() {
  vec2 uv = vUv - 0.5;
  uv *= u_canvas_scale;
  uv /= u_inner_scale;

  float containerAspect = u_ratio;
  float imageAspect = u_img_ratio;
  vec2 scale = vec2(1.0);
  if (containerAspect > imageAspect) {
    scale.y = imageAspect / containerAspect;
  } else {
    scale.x = containerAspect / imageAspect;
  }
  uv *= scale;
  return uv + 0.5;
}

vec2 get_frame_uv() {
  vec2 uv = vUv - 0.5;
  uv *= u_canvas_scale;
  uv /= u_inner_scale;
  return uv + 0.5;
}

float get_img_frame_alpha(vec2 uv, float img_frame_width) {
  float img_frame_alpha = smoothstep(0., img_frame_width, uv.x) * smoothstep(1., 1. - img_frame_width, uv.x);
  img_frame_alpha *= smoothstep(0., img_frame_width, uv.y) * smoothstep(1., 1. - img_frame_width, uv.y);
  return img_frame_alpha;
}

vec3 sample_image_smooth(vec2 uv) {
  vec2 uvc = clamp(uv, 0.0, 1.0);
  vec3 base = texture2D(u_text_texture, vec2(uvc.x, 1.0 - uvc.y)).rgb;

  float yBelow = step(uv.y, 0.0);
  float yAbove = step(1.0, uv.y);
  float xLeft = step(uv.x, 0.0);
  float xRight = step(1.0, uv.x);
  float outOfBounds = max(max(yBelow, yAbove), max(xLeft, xRight));

  if (outOfBounds > 0.0) {
    float d = 0.002;
    vec3 sum = vec3(0.0);
    sum += texture2D(u_text_texture, vec2(clamp(uvc.x - d, 0.0, 1.0), 1.0 - clamp(uvc.y - d, 0.0, 1.0))).rgb;
    sum += texture2D(u_text_texture, vec2(clamp(uvc.x, 0.0, 1.0), 1.0 - clamp(uvc.y - d, 0.0, 1.0))).rgb;
    sum += texture2D(u_text_texture, vec2(clamp(uvc.x + d, 0.0, 1.0), 1.0 - clamp(uvc.y - d, 0.0, 1.0))).rgb;
    sum += texture2D(u_text_texture, vec2(clamp(uvc.x - d, 0.0, 1.0), 1.0 - clamp(uvc.y, 0.0, 1.0))).rgb;
    sum += texture2D(u_text_texture, vec2(clamp(uvc.x, 0.0, 1.0), 1.0 - clamp(uvc.y, 0.0, 1.0))).rgb;
    sum += texture2D(u_text_texture, vec2(clamp(uvc.x + d, 0.0, 1.0), 1.0 - clamp(uvc.y, 0.0, 1.0))).rgb;
    sum += texture2D(u_text_texture, vec2(clamp(uvc.x - d, 0.0, 1.0), 1.0 - clamp(uvc.y + d, 0.0, 1.0))).rgb;
    sum += texture2D(u_text_texture, vec2(clamp(uvc.x, 0.0, 1.0), 1.0 - clamp(uvc.y + d, 0.0, 1.0))).rgb;
    sum += texture2D(u_text_texture, vec2(clamp(uvc.x + d, 0.0, 1.0), 1.0 - clamp(uvc.y + d, 0.0, 1.0))).rgb;
    base = sum / 9.0;
  }
  return base;
}

void main () {
  float offset = texture2D(u_output_texture, vUv).r;

  vec2 velocity = texture2D(u_velocity_texture, vUv).xy;
  velocity += .001;

  vec2 img_uv = get_img_uv();
  img_uv -= u_disturb_power * normalize(velocity) * offset;
  img_uv -= u_disturb_power * normalize(velocity) * offset;

  vec2 frame_uv = get_frame_uv();
  frame_uv -= u_disturb_power * normalize(velocity) * offset;

  vec3 img = sample_image_smooth(img_uv);
  float opacity = get_img_frame_alpha(frame_uv, .002);
  gl_FragColor = vec4(img * opacity, opacity);
}
`;

    function createShader(source: string, type: number) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const info = gl.getShaderInfoLog(shader) || "Shader compile error";
        gl.deleteShader(shader);
        throw new Error(info);
      }
      return shader;
    }

    function createProgramFromSources(vsSource: string, fsSource: string) {
      const program = gl.createProgram();
      const vs = createShader(vsSource, gl.VERTEX_SHADER);
      const fs = createShader(fsSource, gl.FRAGMENT_SHADER);
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.bindAttribLocation(program, 0, "a_position");
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const info = gl.getProgramInfoLog(program) || "Program link error";
        throw new Error(info);
      }
      const uniforms: Record<string, any> = {};
      const uniformCount = gl.getProgramParameter(
        program,
        gl.ACTIVE_UNIFORMS
      );
      for (let i = 0; i < uniformCount; i++) {
        const active = gl.getActiveUniform(program, i);
        if (!active) continue;
        uniforms[active.name] = gl.getUniformLocation(program, active.name);
      }
      return { program, uniforms };
    }

    function blit(target: any = null) {
      const vbo = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]),
        gl.STATIC_DRAW
      );
      const ebo = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
      gl.bufferData(
        gl.ELEMENT_ARRAY_BUFFER,
        new Uint16Array([0, 1, 2, 0, 2, 3]),
        gl.STATIC_DRAW
      );
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(0);
      if (target == null) {
        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      } else {
        gl.viewport(0, 0, target.width, target.height);
        gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
      }
      gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);

      // Clean up temporary buffers to avoid memory bloat
      gl.deleteBuffer(vbo);
      gl.deleteBuffer(ebo);
    }

    function createFBO(w: number, h: number) {
      gl.activeTexture(gl.TEXTURE0);
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      
      const textureType = extFloat ? gl.FLOAT : gl.UNSIGNED_BYTE;
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, w, h, 0, gl.RGB, textureType, null);
      
      const fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        texture,
        0
      );
      gl.viewport(0, 0, w, h);
      gl.clear(gl.COLOR_BUFFER_BIT);
      return {
        fbo,
        texture,
        width: w,
        height: h,
        attach(id: number) {
          gl.activeTexture(gl.TEXTURE0 + id);
          gl.bindTexture(gl.TEXTURE_2D, texture);
          return id;
        },
      };
    }

    function createDoubleFBO(w: number, h: number) {
      let fbo1 = createFBO(w, h);
      let fbo2 = createFBO(w, h);
      return {
        width: w,
        height: h,
        texelSizeX: 1 / Math.max(1, w),
        texelSizeY: 1 / Math.max(1, h),
        read: () => fbo1,
        write: () => fbo2,
        swap() {
          const tmp = fbo1;
          fbo1 = fbo2;
          fbo2 = tmp;
        },
      };
    }

    let splatProgram: any;
    let divergenceProgram: any;
    let pressureProgram: any;
    let gradientSubtractProgram: any;
    let advectionProgram: any;
    let displayProgram: any;

    try {
      splatProgram = createProgramFromSources(VERT, FRAG_POINT);
      divergenceProgram = createProgramFromSources(VERT, FRAG_DIVERGENCE);
      pressureProgram = createProgramFromSources(VERT, FRAG_PRESSURE);
      gradientSubtractProgram = createProgramFromSources(VERT, FRAG_GRAD_SUB);
      advectionProgram = createProgramFromSources(VERT, FRAG_ADVECT);
      displayProgram = createProgramFromSources(VERT, FRAG_OUTPUT);
    } catch (e: any) {
      console.error("Failed to compile shaders:", e);
      setError("Shader compilation error");
      return;
    }

    resizeCanvas();
    initFBOs();
    const cleanupEvents = setupEvents();
    render(0);
    loadImage(imageSrc);

    function initFBOs() {
      const safeW = Math.max(16, res.w);
      const safeH = Math.max(16, res.h);
      outputColor = createDoubleFBO(safeW, safeH);
      velocity = createDoubleFBO(safeW, safeH);
      divergence = createFBO(safeW, safeH);
      pressure = createDoubleFBO(safeW, safeH);
    }

    function updatePointerPosition(eX: number, eY: number) {
      pointer.moved = true;
      pointer.dx = 6 * (eX - pointer.x);
      pointer.dy = 6 * (eY - pointer.y);
      pointer.x = eX;
      pointer.y = eY;
    }

    function setupEvents() {
      const onEnter = () => {
        isHovering = true;
      };
      const onLeave = () => {
        isHovering = false;
        pointer.moved = false;
      };
      const onClick = (e: MouseEvent) => {
        if (!container) return;
        isHovering = true;
        const rect = container.getBoundingClientRect();
        updatePointerPosition(e.clientX - rect.left, e.clientY - rect.top);
      };
      const onMove = (e: MouseEvent) => {
        if (!container) return;
        isHovering = true;
        const rect = container.getBoundingClientRect();
        updatePointerPosition(e.clientX - rect.left, e.clientY - rect.top);
      };
      const onTouchMove = (e: TouchEvent) => {
        if (!container) return;
        isHovering = true;
        if (e.cancelable) e.preventDefault();
        const t = e.targetTouches[0];
        if (t) {
          const rect = container.getBoundingClientRect();
          updatePointerPosition(t.clientX - rect.left, t.clientY - rect.top);
        }
      };
      const onTouchStart = () => {
        isHovering = true;
      };
      const onTouchEnd = () => {
        isHovering = false;
        pointer.moved = false;
      };
      const onResize = () => {
        resizeCanvas();
        initFBOs();
        if (imageTexture && gl) {
          gl.bindTexture(gl.TEXTURE_2D, imageTexture);
        }
      };

      const targetEl = container;
      targetEl.addEventListener("mouseenter", onEnter);
      targetEl.addEventListener("mouseleave", onLeave);
      targetEl.addEventListener("click", onClick);
      targetEl.addEventListener("mousemove", onMove);
      targetEl.addEventListener("touchstart", onTouchStart, { passive: true });
      targetEl.addEventListener("touchend", onTouchEnd, { passive: true });
      targetEl.addEventListener("touchmove", onTouchMove, { passive: false });
      window.addEventListener("resize", onResize);

      const resizeObserver = new ResizeObserver(() => {
        onResize();
      });
      resizeObserver.observe(container);

      return () => {
        targetEl.removeEventListener("mouseenter", onEnter);
        targetEl.removeEventListener("mouseleave", onLeave);
        targetEl.removeEventListener("click", onClick);
        targetEl.removeEventListener("mousemove", onMove);
        targetEl.removeEventListener("touchstart", onTouchStart);
        targetEl.removeEventListener("touchend", onTouchEnd);
        targetEl.removeEventListener("touchmove", onTouchMove);
        window.removeEventListener("resize", onResize);
        resizeObserver.disconnect();
      };
    }

    function resizeCanvas() {
      if (!container || !canvas) return;
      const width = container.clientWidth || 400;
      const height = container.clientHeight || 500;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(2, Math.round(width * overscanFactor * dpr));
      canvas.height = Math.max(2, Math.round(height * overscanFactor * dpr));
      const cssW = width * overscanFactor;
      const cssH = height * overscanFactor;
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      const ratio = cssW / Math.max(1, cssH);
      const baseResolution = 128 + ((resolution - 1) * (512 - 128)) / 9;
      res.w = Math.round(baseResolution * ratio);
      res.h = Math.round(baseResolution);
    }

    function getPointerUV() {
      if (!container) return { u: 0.5, v: 0.5 };
      const cssW = (container.clientWidth || 400) * overscanFactor;
      const cssH = (container.clientHeight || 500) * overscanFactor;
      const dx = 0.5 * (cssW - (container.clientWidth || 400));
      const dy = 0.5 * (cssH - (container.clientHeight || 500));
      const u = (pointer.x + dx) / cssW;
      const v = 1 - (pointer.y + dy) / cssH;
      return { u, v };
    }

    function loadImage(src: string) {
      setLoading(true);
      setError(null);
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = src;
      img.onload = () => {
        setLoading(false);
        imgRatio = img.naturalWidth / Math.max(1, img.naturalHeight);
        if (imageTexture) {
          gl.deleteTexture(imageTexture);
        }
        imageTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, imageTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, imageTexture);
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          img
        );
      };
      img.onerror = () => {
        setLoading(false);
        const errStr = "Failed to load image. Make sure CORS is allowed or link is valid.";
        setError(errStr);
        if (onImageError) onImageError(errStr);
      };
    }

    function render(_t: number) {
      if (!container || !canvas) return;
      const dt = 1 / 60;
      if (pointer.moved) {
        if (!isPreview) pointer.moved = false;
        gl.useProgram(splatProgram.program);
        gl.uniform1i(
          splatProgram.uniforms.u_input_texture,
          velocity.read().attach(1)
        );
        gl.uniform1f(
          splatProgram.uniforms.u_ratio,
          (container.clientWidth || 400) / Math.max(1, container.clientHeight || 500)
        );
        const uv = getPointerUV();
        gl.uniform2f(splatProgram.uniforms.u_point, uv.u, uv.v);
        gl.uniform3f(
          splatProgram.uniforms.u_point_value,
          pointer.dx,
          -pointer.dy,
          0
        );
        const ch = Math.max(1, container.clientHeight || 500);
        const rr = params.cursorRadiusPx / ch;
        gl.uniform1f(splatProgram.uniforms.u_point_size, rr * rr);
        blit(velocity.write());
        velocity.swap();
        gl.uniform1i(
          splatProgram.uniforms.u_input_texture,
          outputColor.read().attach(1)
        );
        gl.uniform3f(
          splatProgram.uniforms.u_point_value,
          params.cursorPower * 0.001,
          0,
          0
        );
        blit(outputColor.write());
        outputColor.swap();
      }

      gl.useProgram(divergenceProgram.program);
      gl.uniform2f(
        divergenceProgram.uniforms.u_texel,
        velocity.texelSizeX,
        velocity.texelSizeY
      );
      gl.uniform1i(
        divergenceProgram.uniforms.u_velocity_texture,
        velocity.read().attach(1)
      );
      blit(divergence);

      gl.useProgram(pressureProgram.program);
      gl.uniform2f(
        pressureProgram.uniforms.u_texel,
        velocity.texelSizeX,
        velocity.texelSizeY
      );
      gl.uniform1i(
        pressureProgram.uniforms.u_divergence_texture,
        divergence.attach(1)
      );
      for (let i = 0; i < 16; i++) {
        gl.uniform1i(
          pressureProgram.uniforms.u_pressure_texture,
          pressure.read().attach(2)
        );
        blit(pressure.write());
        pressure.swap();
      }

      gl.useProgram(gradientSubtractProgram.program);
      gl.uniform2f(
        gradientSubtractProgram.uniforms.u_texel,
        velocity.texelSizeX,
        velocity.texelSizeY
      );
      gl.uniform1i(
        gradientSubtractProgram.uniforms.u_pressure_texture,
        pressure.read().attach(1)
      );
      gl.uniform1i(
        gradientSubtractProgram.uniforms.u_velocity_texture,
        velocity.read().attach(2)
      );
      blit(velocity.write());
      velocity.swap();

      gl.useProgram(advectionProgram.program);
      gl.uniform2f(
        advectionProgram.uniforms.u_texel,
        velocity.texelSizeX,
        velocity.texelSizeY
      );
      gl.uniform2f(
        advectionProgram.uniforms.u_output_textel,
        velocity.texelSizeX,
        velocity.texelSizeY
      );
      gl.uniform1i(
        advectionProgram.uniforms.u_velocity_texture,
        velocity.read().attach(1)
      );
      gl.uniform1i(
        advectionProgram.uniforms.u_input_texture,
        velocity.read().attach(1)
      );
      gl.uniform1f(advectionProgram.uniforms.u_dt, dt);
      gl.uniform1f(advectionProgram.uniforms.u_dissipation, 0.97);
      blit(velocity.write());
      velocity.swap();

      gl.useProgram(advectionProgram.program);
      gl.uniform2f(
        advectionProgram.uniforms.u_output_textel,
        outputColor.texelSizeX,
        outputColor.texelSizeY
      );
      gl.uniform1i(
        advectionProgram.uniforms.u_input_texture,
        outputColor.read().attach(2)
      );
      gl.uniform1f(advectionProgram.uniforms.u_dt, 8 * dt);
      gl.uniform1f(advectionProgram.uniforms.u_dissipation, 0.98);
      blit(outputColor.write());
      outputColor.swap();

      gl.useProgram(displayProgram.program);
      const uv2 = getPointerUV();
      gl.uniform2f(displayProgram.uniforms.u_point, uv2.u, uv2.v);
      gl.uniform1i(
        displayProgram.uniforms.u_velocity_texture,
        velocity.read().attach(2)
      );
      gl.uniform1f(
        displayProgram.uniforms.u_ratio,
        (container.clientWidth || 400) / Math.max(1, container.clientHeight || 500)
      );
      gl.uniform1f(displayProgram.uniforms.u_img_ratio, imgRatio);
      gl.uniform1f(
        displayProgram.uniforms.u_disturb_power,
        params.distortionPower
      );
      gl.uniform1i(
        displayProgram.uniforms.u_output_texture,
        outputColor.read().attach(1)
      );
      gl.uniform1f(displayProgram.uniforms.u_canvas_scale, 1);
      gl.uniform1f(displayProgram.uniforms.u_inner_scale, innerScale);
      if (imageTexture) {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, imageTexture);
        gl.uniform1i(displayProgram.uniforms.u_text_texture, 0);
      }
      blit();
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);

      rafRef.current = requestAnimationFrame(render);
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (typeof cleanupEvents === "function") cleanupEvents();
      if (imageTexture) gl.deleteTexture(imageTexture);
    };
  }, [imageSrc, resolution, cursorSize, intensity]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden cursor-crosshair group select-none ${className}`}
      style={{
        position: "relative",
        ...style,
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          top: "-10%",
          left: "-10%",
          width: "120%",
          height: "120%",
          pointerEvents: "auto",
        }}
      />

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-stone-900/10 backdrop-blur-sm z-10 transition-opacity">
          <div className="flex flex-col items-center gap-2 bg-white/90 px-4 py-3 rounded-2xl shadow-lg border border-stone-200">
            <div className="w-5 h-5 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-[11px] text-stone-700 font-mono tracking-wider font-medium">LOADING IMAGE...</span>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-stone-900/20 backdrop-blur-sm p-6 z-10 text-center">
          <div className="max-w-xs space-y-2 bg-white/95 p-4 rounded-2xl shadow-lg border border-stone-200">
            <p className="text-xs font-semibold text-rose-600 font-mono uppercase tracking-wider">Image Load Warning</p>
            <p className="text-xs text-stone-600">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
}
