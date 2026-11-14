// Painting loops for the ships, harbour, waves and lighthouse, ported from
// figcraft-work/jobkompass/motion/build2.py (ships, harbour) and build3.py (waves, signal).
// One shader covers both: build3's water rectangle, swell and beam, plus build2's pennant
// wave and water-masked reflections. Coordinates are in pixels of the prototype images,
// scaled by k; every motion is a whole number of cycles per loop.
export const SCENE_LOOP_SECONDS = 10;

export interface JkScene {
  /** Pixel size of the prototype image the coordinates were measured on. */
  space: [number, number];
  k: number;
  horizon: number;
  gain: number;
  swell: number;
  focus: [number, number];
  /** Water only inside [x0, y0, x1, y1]. */
  wrect: [number, number, number, number];
  /** [cx, cy, rx, ry, lift px, rock rad, cycles, phase] */
  solids: number[][];
  /** [x, y, r, R, G, B, kind, strength, follow] kind 0 flame, 1 blink, 2 breathe, 3+ buoys in order; follow 0 rides solid 0, -1 fixed */
  glows: number[][];
  /** [x, y, cycles] */
  stars: number[][];
  /** [x0, y0, x1, y1, amp] */
  beam: number[];
  /** [cx, cy, rx, ry, amp] */
  flag: number[];
  /** Glows below the horizon only show through water (reflections), as in build2. */
  maskReflections: boolean;
}

const K = 900 / 1254;
const NONE = [0, 0, 0, 0, 0];
const FULL: [number, number, number, number] = [-1e4, -1e4, 1e5, 1e5];

export const SCENES = {
  ship1: { maskReflections: true, space: [900, 900], k: K, horizon: 868, gain: 1, swell: 0, focus: [0.5, 0.86], wrect: FULL,
    solids: [[620, 850, 235, 115, 4.0, 0.02, 2, 0.0]],
    glows: [[480, 800, 62, 1, 0.6, 0.2, 0, 0.55, 0], [490, 965, 70, 1, 0.6, 0.2, 0, 0.14, -1]],
    stars: [[185, 117, 2], [105, 255, 3], [980, 318, 2], [1143, 115, 4]], beam: NONE, flag: NONE },
  ship2: { maskReflections: true, space: [900, 900], k: K, horizon: 848, gain: 1, swell: 0, focus: [0.5, 0.8], wrect: FULL,
    solids: [[640, 725, 270, 265, 4.5, 0.022, 2, 0.1]],
    glows: [[455, 797, 62, 1, 0.6, 0.2, 0, 0.55, 0], [475, 965, 72, 1, 0.6, 0.2, 0, 0.14, -1]],
    stars: [[228, 118, 2], [152, 216, 3], [1089, 238, 4]], beam: NONE, flag: NONE },
  ship3: { maskReflections: true, space: [900, 900], k: K, horizon: 855, gain: 1, swell: 0, focus: [0.5, 0.74], wrect: FULL,
    solids: [[630, 625, 450, 405, 3.5, 0.013, 2, 0.2]],
    glows: [[263, 800, 58, 1, 0.6, 0.2, 0, 0.5, 0], [993, 790, 58, 1, 0.6, 0.2, 0, 0.5, 0], [485, 838, 46, 1, 0.72, 0.35, 0, 0.16, 0],
      [270, 975, 62, 1, 0.6, 0.2, 0, 0.13, -1], [935, 975, 62, 1, 0.6, 0.2, 0, 0.13, -1]],
    stars: [[199, 81, 2], [112, 203, 3], [960, 268, 2], [1102, 112, 4]], beam: NONE, flag: [578, 326, 78, 44, 5.0] },
  ship4: { maskReflections: true, space: [900, 900], k: K, horizon: 880, gain: 1, swell: 0, focus: [0.5, 0.7], wrect: FULL,
    solids: [[630, 605, 585, 445, 3.0, 0.01, 2, 0.3]],
    glows: [[150, 800, 56, 1, 0.6, 0.2, 0, 0.5, 0], [1005, 830, 56, 1, 0.6, 0.2, 0, 0.5, 0], [540, 868, 230, 1, 0.72, 0.35, 0, 0.07, 0],
      [1212, 768, 22, 0.55, 0.95, 1, 1, 0.9, -1]],
    stars: [[184, 88, 2], [92, 199, 3], [1130, 150, 4], [1100, 323, 2]], beam: NONE, flag: [735, 312, 175, 92, 5.5] },
  harbour: { maskReflections: true, space: [1672, 941], k: 1, horizon: 640, gain: 1, swell: 0, focus: [0.38, 1.0], wrect: FULL,
    solids: [[690, 650, 235, 365, 3.2, 0.011, 2, 0.0], [977, 742, 36, 40, 2.6, 0, 3, 0.1], [1105, 724, 30, 34, 2.2, 0, 3, 0.36], [1208, 707, 24, 27, 1.8, 0, 3, 0.6], [1285, 688, 18, 20, 1.4, 0, 3, 0.82],
      [230, 770, 345, 205, 0, 0, 1, 0], [170, 905, 310, 115, 0, 0, 1, 0]],
    glows: [[537, 630, 74, 1, 0.62, 0.22, 0, 0.42, -1], [264, 232, 95, 1, 0.8, 0.45, 2, 0.3, -1], [540, 865, 72, 1, 0.6, 0.2, 0, 0.16, -1],
      [977, 715, 20, 0.62, 0.34, 0.95, 3, 0.9, -1], [1105, 702, 18, 0.45, 0.42, 1, 4, 0.9, -1], [1208, 692, 16, 0.2, 0.66, 1, 5, 0.9, -1], [1285, 678, 14, 0.55, 0.97, 1, 6, 0.9, -1]],
    stars: [[420, 90, 2], [760, 140, 3], [1010, 70, 4], [1300, 160, 2]], beam: NONE, flag: NONE },
  waves: { maskReflections: false, space: [1672, 941], k: 1, horizon: -60, gain: 1.2, swell: 1.0, focus: [0.5, 0.5], wrect: [0, 0, 1672, 941],
    solids: [], glows: [], stars: [], beam: NONE, flag: NONE },
  signal: { maskReflections: false, space: [1560, 850], k: 1, horizon: 522, gain: 1.3, swell: 0.5, focus: [1.0, 0.35], wrect: [0, 0, 1560, 850],
    solids: [[130, 560, 120, 160, 3.0, 0.012, 2, 0.0], [499, 618, 34, 36, 2.4, 0, 3, 0.1], [681, 612, 32, 34, 2.2, 0, 3, 0.34], [866, 606, 34, 34, 2.0, 0, 3, 0.58], [1051, 600, 34, 34, 1.8, 0, 3, 0.82],
      [1420, 560, 260, 125, 0, 0, 1, 0], [1470, 330, 90, 220, 0, 0, 1, 0]],
    glows: [[229, 584, 46, 1, 0.62, 0.22, 0, 0.5, 0], [1458, 232, 95, 1, 0.82, 0.48, 2, 0.75, -1], [200, 690, 70, 1, 0.6, 0.2, 0, 0.14, -1],
      [499, 600, 18, 0.62, 0.34, 0.95, 3, 0.9, -1], [681, 594, 18, 0.45, 0.42, 1, 4, 0.9, -1], [866, 588, 18, 0.2, 0.66, 1, 5, 0.9, -1], [1051, 582, 18, 0.55, 0.97, 1, 6, 0.9, -1]],
    stars: [[141, 60, 2], [342, 214, 3], [1040, 112, 2], [1518, 72, 4], [833, 15, 3], [580, 33, 2]], beam: [1410, 262, 250, 600, 2.4], flag: NONE },
} satisfies Record<string, JkScene>;

export type JkSceneName = keyof typeof SCENES;

export const SCENE_FRAGMENT = `precision highp float;
uniform sampler2D u_tex; uniform vec2 u_res, u_img, u_focus; uniform float u_t, u_horizon, u_gain, u_k, u_swell;
uniform vec4 u_sol[7]; uniform vec4 u_solm[7]; uniform vec4 u_glo[8]; uniform vec4 u_gloc[8]; uniform vec3 u_glom[8]; uniform vec3 u_star[6];
uniform vec4 u_wrect; uniform vec4 u_beam; uniform float u_beamAmp; uniform vec4 u_flag; uniform float u_flagAmp; uniform float u_day;
#define TAU 6.28318530718
float ell(vec2 p, vec2 c, vec2 r){ return 1.0 - smoothstep(0.62, 1.0, length((p-c)/r)); }
float glow(vec2 p, vec2 c, float r){ vec2 d=(p-c)/r; return exp(-dot(d,d)); }
void main(){
  vec2 frag = vec2(gl_FragCoord.x, u_res.y - gl_FragCoord.y);
  float s = max(u_res.x/u_img.x, u_res.y/u_img.y)*(u_swell > 0.0 ? 1.04 : 1.0);
  vec2 vis = u_res/s; vec2 p = frag/s + (u_img - vis)*u_focus;
  vec2 q = p; float solid = 0.0; vec2 lift0 = vec2(0.0);
  for (int i=0;i<7;i++){
    vec4 e = u_sol[i]*u_k; vec4 m = u_solm[i]; if (e.z <= 0.0) continue; float mk = ell(p, e.xy, e.zw);
    float a = 0.25*m.y*u_gain*sin(TAU*(u_t*m.z+m.w+0.12)); float lift = 0.55*m.x*u_k*u_gain*sin(TAU*(u_t*m.z+m.w)); // bob, barely tilt (Nov 12)
    vec2 c = e.xy + vec2(0.0, e.w*0.62); vec2 d = p-c;
    vec2 bq = c + vec2(d.x*cos(a)-d.y*sin(a), d.x*sin(a)+d.y*cos(a)) + vec2(0.0, lift);
    q = mix(q, bq, mk); solid = max(solid, mk); if (i==0) lift0 = vec2(0.0, lift);
  }
  if (u_flagAmp > 0.0){ float fm = ell(p, u_flag.xy*u_k, u_flag.zw*u_k);
    q.y += fm*u_flagAmp*u_k*u_gain*sin((p.x/u_k)*0.07 - TAU*u_t*4.0)*((p.x - (u_flag.x-u_flag.z)*u_k)/(2.0*u_flag.z*u_k)); }
  float hz = u_horizon*u_k; float depth = clamp((p.y-hz)/(u_img.y-hz), 0.0, 1.0);
  vec4 wr = u_wrect*u_k; float e2 = 10.0*u_k;
  float inr = smoothstep(wr.x, wr.x+e2, p.x)*(1.0-smoothstep(wr.z-e2, wr.z, p.x))*(1.0-smoothstep(wr.w-e2, wr.w, p.y));
  float w = smoothstep(hz+4.0*u_k, hz+34.0*u_k, p.y)*(1.0-solid)*inr;
  vec2 pp = p/u_k;
  float dx = (1.5+7.0*depth)*sin(pp.y*0.085 + TAU*u_t*3.0) + (0.8+3.0*depth)*sin(pp.y*0.21 - TAU*u_t*5.0 + pp.x*0.012);
  float dy = (0.6+2.2*depth)*sin(pp.x*0.021 + pp.y*0.03 + TAU*u_t*2.0);
  q += w*vec2(dx,dy)*u_k*u_gain*0.65; // calmer than the prototype, per Itwela Nov 12
  float sw1 = sin(pp.x*0.0065 + pp.y*0.004 + TAU*u_t), sw2 = sin(pp.x*0.014 - pp.y*0.009 - TAU*u_t*2.0);
  q += 0.65*w*u_swell*u_gain*u_k*vec2(9.0*sin(pp.y*0.013 + TAU*u_t), 11.0*sw1 + 5.0*sw2);
  vec3 col = texture2D(u_tex, clamp(q/u_img, 0.0, 1.0)).rgb;
  float gl = pow(max(0.0, sin(pp.x*0.045 + pp.y*0.16 + TAU*u_t*4.0)*sin(pp.y*0.31 - TAU*u_t*3.0)), 8.0);
  col += vec3(0.30,0.55,0.66)*gl*w*0.20*(0.3+depth)*min(u_gain,1.0);
  col *= 1.0 + w*u_swell*0.16*sw1;
  vec3 base = col; // by day, beam, lanterns, buoy lights and stars are dimmed to a fifth
  if (u_beamAmp > 0.0){ vec2 a = u_beam.xy*u_k, b = u_beam.zw*u_k; vec2 ab = b-a; float tt = clamp(dot(p-a,ab)/dot(ab,ab), 0.0, 1.0);
    float dist = length(p-(a+ab*tt)); float wid = mix(22.0, 120.0, tt)*u_k; float lum = dot(col, vec3(0.3,0.5,0.2));
    col += vec3(0.25,0.75,0.8)*exp(-dist*dist/(wid*wid))*smoothstep(0.32,0.62,lum)*u_beamAmp*0.22*(0.35+0.65*(0.5+0.5*sin(TAU*u_t)))*(0.7+0.3*sin(tt*26.0 - TAU*u_t*3.0))*(1.0-tt*0.5); }
  float flick = 0.72 + 0.16*sin(TAU*u_t*7.0) + 0.12*sin(TAU*u_t*13.0+1.3);
  for (int i=0;i<8;i++){
    vec4 g = u_glo[i]; vec4 gc = u_gloc[i]; vec3 gm = u_glom[i]; if (g.z <= 0.0) continue;
    vec2 c = g.xy*u_k + (gm.z > -0.5 ? lift0 : vec2(0.0)); float r = g.z*u_k; float kind = gc.a; float v;
    if (kind < 0.5) v = flick; else if (kind < 1.5) v = pow(max(0.0, sin(TAU*u_t*2.0)), 6.0);
    else if (kind < 2.5) v = 0.6 + 0.4*sin(TAU*u_t); else v = pow(max(0.0, sin(TAU*(u_t*2.0 - (kind-3.0)*0.16))), 5.0);
    col += gc.rgb*(glow(p,c,r)*0.6 + glow(p,c,r*0.3)*0.5)*gm.x*v*(p.y > hz && gm.y > 0.5 ? w : 1.0);
  }
  for (int i=0;i<6;i++){ vec3 st = u_star[i]; if (st.z <= 0.0) continue;
    col += vec3(1.0,0.95,0.82)*(glow(p, st.xy*u_k, 5.0*u_k+1.0)+0.5*glow(p, st.xy*u_k, 16.0*u_k+2.0))*(0.05+1.25*pow(0.5+0.5*sin(TAU*(u_t*st.z + float(i)*0.27)),2.0)); }
  col = base + (col - base)*(1.0 - 0.8*u_day);
  gl_FragColor = vec4(col, 1.0);
}`;
