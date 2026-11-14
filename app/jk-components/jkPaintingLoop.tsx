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
  /** Called once after the program links, to set scene uniforms. */
  setup?: (gl: WebGLRenderingContext, U: (name: string) => WebGLUniformLocation | null) => void;
  /** Fixed focus point (0..1 each axis) sent as a vec2; without it a float is sent, as the hero shader expects. */
  focus?: [number, number];
  /** Motion strength (u_gain). */
  gain?: number;
  /** Selector of an ancestor whose hover multiplies the gain, easing in and out. */
  hoverHost?: string;
  hoverGain?: number;
}

/**
 * Animates a painting with a WebGL fragment shader. It sits on top of a plain
 * <img> of the same painting, so if WebGL is missing, the image fails to load,
 * or the visitor prefers reduced motion, the still painting simply stays.
 */
export default function JkPaintingLoop({ src, fragment, loopSeconds = 10, space, className, setup, focus, gain = 1, hoverHost, hoverGain = 1.9 }: JkPaintingLoopProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const hoverEl = hoverHost ? host.closest<HTMLElement>(hoverHost) : null;
    let target = gain;
    const onEnter = () => { target = gain * hoverGain; };
    const onLeave = () => { target = gain; };
    hoverEl?.addEventListener("pointerenter", onEnter);
    hoverEl?.addEventListener("pointerleave", onLeave);
    const t0 = performance.now();

    // Browsers keep only ~16 WebGL contexts alive and silently kill the oldest, so a
    // context exists only while its painting is on screen (display:none never is):
    // a fresh canvas is made on entry and its context released on exit.
    let stop: (() => void) | null = null;
    const begin = () => {
      const cv = document.createElement("canvas");
      cv.className = "pointer-events-none absolute inset-0 size-full opacity-0 transition-opacity duration-700";
      host.appendChild(cv);
      const gl = cv.getContext("webgl", { antialias: false });
      if (!gl) { cv.remove(); return null; }
      const compile = (type: number, source: string) => {
        const sh = gl.createShader(type);
        if (!sh) return null;
        gl.shaderSource(sh, source);
        gl.compileShader(sh);
        return gl.getShaderParameter(sh, gl.COMPILE_STATUS) ? sh : null;
      };
      const vs = compile(gl.VERTEX_SHADER, "attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}");
      const fs = compile(gl.FRAGMENT_SHADER, fragment);
      const program = gl.createProgram();
      if (!vs || !fs || !program) { cv.remove(); return null; }
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { cv.remove(); return null; }
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(program, "a");
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      const U = (n: string) => gl.getUniformLocation(program, n);
      setup?.(gl, U);
      const [spaceW, spaceH] = space ?? [undefined, undefined];
      let ready = false;
      let g = target;
      let raf = 0;
      const img = new Image();
      img.onload = () => {
        gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
        // The shader addresses the painting in its authored pixel space; the texture
        // itself is sampled normalised, so its real resolution does not matter.
        gl.uniform2f(U("u_img"), spaceW ?? img.naturalWidth, spaceH ?? img.naturalHeight);
        ready = true;
      };
      img.src = src;
      const frame = (now: number) => {
        raf = requestAnimationFrame(frame);
        if (!ready || document.hidden) return;
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
        if (focus) gl.uniform2f(U("u_focus"), focus[0], focus[1]);
        else gl.uniform1f(U("u_focus"), w / h < 1.1 ? 1.0 : 0.5);
        g += (target - g) * 0.06;
        gl.uniform1f(U("u_gain"), g);
        gl.uniform1f(U("u_t"), (((now - t0) / 1000) % loopSeconds) / loopSeconds);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        if (cv.dataset.ready !== "true") { cv.dataset.ready = "true"; cv.style.opacity = "1"; }
      };
      raf = requestAnimationFrame(frame);
      return () => {
        cancelAnimationFrame(raf);
        img.onload = null;
        gl.getExtension("WEBGL_lose_context")?.loseContext();
        cv.remove();
      };
    };

    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !stop) stop = begin();
      else if (!e.isIntersecting && stop) { stop(); stop = null; }
    }, { rootMargin: "200px 0px" });
    io.observe(host);

    return () => {
      io.disconnect();
      stop?.();
      hoverEl?.removeEventListener("pointerenter", onEnter);
      hoverEl?.removeEventListener("pointerleave", onLeave);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, fragment, loopSeconds, space?.[0], space?.[1], gain, hoverHost]);

  // The canvas is created inside this box only while it is on screen; the still <img> underneath shows otherwise.
  return <div ref={ref} aria-hidden className={cn("pointer-events-none", className)} />;
}
