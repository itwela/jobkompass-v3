'use client'

import JkPaintingLoop from "./jkPaintingLoop";
import { SCENES, SCENE_FRAGMENT, SCENE_LOOP_SECONDS, type JkSceneName } from "./jk-landing/jkSceneShader";

const pad = (rows: number[][], n: number, w: number, pick: (r: number[]) => number[]) => {
  const out = new Float32Array(n * w);
  rows.slice(0, n).forEach((r, i) => out.set(pick(r), i * w));
  return out;
};

/**
 * A night painting brought to life by the shared scene shader. Place it over the
 * still painting; it fades in once drawable and does nothing in light mode's
 * absence of a canvas or for reduced-motion visitors.
 */
export default function JkSceneLoop({ scene, className, gain = 1, hoverHost, day = false, focus }: { scene: JkSceneName; className?: string; gain?: number; hoverHost?: string; day?: boolean; /** Crop centre override, 0..1 each. */ focus?: [number, number] }) {
  const sc = SCENES[scene];
  return (
    <JkPaintingLoop
      src={`/images/v4/${scene}-${day ? "day" : "night"}.webp`}
      fragment={SCENE_FRAGMENT}
      loopSeconds={SCENE_LOOP_SECONDS}
      space={sc.space as [number, number]}
      focus={focus ?? (sc.focus as [number, number])}
      gain={sc.gain * gain}
      hoverHost={hoverHost}
      className={className}
      setup={(gl, U) => {
        gl.uniform4fv(U("u_sol"), pad(sc.solids, 7, 4, (r) => r.slice(0, 4)));
        gl.uniform4fv(U("u_solm"), pad(sc.solids, 7, 4, (r) => r.slice(4, 8)));
        gl.uniform4fv(U("u_glo"), pad(sc.glows, 8, 4, (r) => [r[0], r[1], r[2], 0]));
        gl.uniform4fv(U("u_gloc"), pad(sc.glows, 8, 4, (r) => [r[3], r[4], r[5], r[6]]));
        gl.uniform3fv(U("u_glom"), pad(sc.glows, 8, 3, (r) => [r[7], sc.maskReflections && r[1] > sc.horizon ? 1 : 0, r[8]]));
        gl.uniform3fv(U("u_star"), pad(sc.stars, 6, 3, (r) => r));
        gl.uniform4fv(U("u_wrect"), sc.wrect);
        gl.uniform4fv(U("u_beam"), sc.beam.slice(0, 4));
        gl.uniform1f(U("u_beamAmp"), sc.beam[4]);
        gl.uniform4fv(U("u_flag"), sc.flag.slice(0, 4));
        gl.uniform1f(U("u_flagAmp"), sc.flag[4]);
        gl.uniform1f(U("u_horizon"), sc.horizon);
        gl.uniform1f(U("u_swell"), sc.swell);
        gl.uniform1f(U("u_k"), sc.k);
        gl.uniform1f(U("u_day"), day ? 1 : 0);
      }}
    />
  );
}
