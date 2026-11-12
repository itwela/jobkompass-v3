'use client'

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface JkPaintingLoopProps {
  /** Image the shader animates. Must be same-origin. */
  src: string;
  /** Fragment shader with uniforms u_tex, u_res, u_img, u_t (0..1 through the loop) and u_focus. */
  fragment: string;
  loopSeconds?: number;
  /** Size of the coordinate space the shader was written in. Defaults to the image's own size. */
  space?: [number, number];
  className?: string;
}

/**
 * Animates a painting with a WebGL fragment shader. It sits on top of a plain
 * <img> of the same painting, so if WebGL is missing, the image fails to load,
 * or the visitor prefers reduced motion, the still painting simply stays.
 */
export default function JkPaintingLoop({ src, fragment, loopSeconds = 10, space, className }: JkPaintingLoopProps) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const gl = cv.getContext("webgl", { antialias: false });
    if (!gl) return;

    const compile = (type: number, source: string) => {
      const s = gl.createShader(type);
      if (!s) return null;
      gl.shaderSource(s, source);
      gl.compileShader(s);
      return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
    };
    const vs = compile(gl.VERTEX_SHADER, "attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}");
    const fs = compile(gl.FRAGMENT_SHADER, fragment);
    const program = gl.createProgram();
    if (!vs || !fs || !program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(program, "a");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = (n: string) => gl.getUniformLocation(program, n);

    const [spaceW, spaceH] = space ?? [undefined, undefined];
    let ready = false;
    let visible = true;
    let raf = 0;
    let disposed = false;
    const start = performance.now();

    const img = new Image();
    img.onload = () => {
      if (disposed) return;
      const tx = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tx);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
      // The shader addresses the painting in its authored pixel space; the texture
      // itself is sampled normalised, so its real resolution does not matter.
      gl.uniform2f(U("u_img"), spaceW ?? img.naturalWidth, spaceH ?? img.naturalHeight);
      ready = true;
      cv.dataset.ready = "true";
    };
    img.src = src;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (!ready || !visible || document.hidden) return;
      const d = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.round(cv.clientWidth * d);
      const h = Math.round(cv.clientHeight * d);
      if (w === 0 || h === 0) return;
      if (cv.width !== w || cv.height !== h) {
        cv.width = w;
        cv.height = h;
        gl.viewport(0, 0, w, h);
      }
      gl.uniform2f(U("u_res"), w, h);
      gl.uniform1f(U("u_focus"), w / h < 1.1 ? 1.0 : 0.5);
      gl.uniform1f(U("u_t"), (((now - start) / 1000) % loopSeconds) / loopSeconds);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
    raf = requestAnimationFrame(frame);
    const io = new IntersectionObserver((e) => { visible = e[0].isIntersecting; });
    io.observe(cv);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      io.disconnect();
      img.onload = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, fragment, loopSeconds, space?.[0], space?.[1]]);

  // Invisible until the first frame is drawable, so the <img> underneath shows first.
  return <canvas ref={ref} aria-hidden className={cn("pointer-events-none opacity-0 transition-opacity duration-700 data-[ready=true]:opacity-100", className)} />;
}
