// Hero painting loop, ported unchanged from figcraft-work/jobkompass/motion/hero-loop.html.
// Coordinates are in pixels of the 1672 x 941 night painting. Every motion completes a whole
// number of cycles per loop, so the last frame equals the first.
export const HERO_LOOP_SECONDS = 10;

export const HERO_LOOP_FRAGMENT = `precision highp float;
uniform sampler2D u_tex; uniform vec2 u_res; uniform vec2 u_img; uniform float u_t; uniform float u_focus;
#define TAU 6.28318530718
float ell(vec2 p, vec2 c, vec2 r){ return 1.0 - smoothstep(0.62, 1.0, length((p-c)/r)); }
float glow(vec2 p, vec2 c, float r){ vec2 d=(p-c)/r; return exp(-dot(d,d)); }
vec2 bob(vec2 p, vec2 q, vec2 c, vec2 r, float amp, float n, float ph, out float m){ m = ell(p,c,r); return q + vec2(0.0, m*amp*sin(TAU*(u_t*n+ph))); }
vec3 star(vec2 p, vec2 c, float n, float ph){ return vec3(1.0,0.95,0.82)*glow(p,c,4.5)*(0.25+0.75*(0.5+0.5*sin(TAU*(u_t*n+ph)))); }
vec3 beacon(vec2 p, vec2 top, vec3 col, float i, float dy){
  float pulse = pow(max(0.0, sin(TAU*(u_t*2.0 - i*0.16))), 5.0);
  vec2 t = top + vec2(0.0, dy);
  return col*(glow(p,t,24.0)*0.85 + glow(p,t,7.0)*0.9 + glow(p, t+vec2(0.0,95.0), 22.0)*0.25)*pulse;
}
void main(){
  vec2 frag = vec2(gl_FragCoord.x, u_res.y - gl_FragCoord.y);
  float s = max(u_res.x/u_img.x, u_res.y/u_img.y);
  vec2 vis = u_res/s;                                   // visible size in image px
  vec2 org = vec2((u_img.x-vis.x)*u_focus, u_img.y-vis.y); // keep the sea at the bottom; slide horizontally by focus
  vec2 p = frag/s + org;
  vec2 q = p;
  // boat: rock about the keel + rise and fall
  float bm = ell(p, vec2(352.0,650.0), vec2(170.0,205.0));
  float a = 0.020*sin(TAU*(u_t*2.0+0.12));
  float lift = 4.5*sin(TAU*u_t*2.0);
  vec2 c = vec2(356.0,778.0); vec2 d = p-c;
  vec2 bq = c + vec2(d.x*cos(a)-d.y*sin(a), d.x*sin(a)+d.y*cos(a)) + vec2(0.0, lift);
  q = mix(q, bq, bm);
  // buoys
  float m1; float m2; float m3; float m4;
  q = bob(p, q, vec2(687.0,712.0), vec2(48.0,58.0), 3.2, 3.0, 0.10, m1);
  q = bob(p, q, vec2(898.0,662.0), vec2(40.0,48.0), 2.6, 3.0, 0.38, m2);
  q = bob(p, q, vec2(1034.0,634.0), vec2(32.0,40.0), 2.0, 3.0, 0.61, m3);
  q = bob(p, q, vec2(1138.0,610.0), vec2(26.0,32.0), 1.5, 3.0, 0.83, m4);
  float solid = clamp(bm + m1 + m2 + m3 + m4, 0.0, 1.0);
  // water: only below the horizon, stronger with depth, never on the hulls or the rocks
  float depth = clamp((p.y-594.0)/347.0, 0.0, 1.0);
  float shore = 1.0 - smoothstep(1180.0, 1330.0, p.x)*(1.0 - smoothstep(600.0, 660.0, p.y));
  float w = smoothstep(596.0, 626.0, p.y)*(1.0-solid)*shore;
  float dx = (1.5+7.0*depth)*sin(p.y*0.085 + TAU*u_t*3.0) + (0.8+3.0*depth)*sin(p.y*0.21 - TAU*u_t*5.0 + p.x*0.012);
  float dy = (0.6+2.2*depth)*sin(p.x*0.021 + p.y*0.03 + TAU*u_t*2.0);
  q += w*vec2(dx, dy);
  vec3 col = texture2D(u_tex, clamp(q/u_img, 0.0, 1.0)).rgb;
  // moving glints on the water
  float gl = pow(max(0.0, sin(p.x*0.045 + p.y*0.16 + TAU*u_t*4.0)*sin(p.y*0.31 - TAU*u_t*3.0)), 8.0);
  col += vec3(0.25,0.55,0.62)*gl*w*0.22*(0.3+depth);
  // lighthouse beam
  vec2 L = vec2(1470.0,372.0); vec2 v = p-L;
  float ang = atan(v.y, max(-v.x, 0.0001));
  float inside = smoothstep(0.070,0.105,ang)*(1.0-smoothstep(0.315,0.360,ang))*step(v.x,0.0)*(1.0-smoothstep(578.0,598.0,p.y));
  float fall = exp(-length(v)/1300.0);
  float breath = 0.5+0.5*sin(TAU*u_t);
  float band = exp(-pow((ang - mix(0.11,0.32, 0.5-0.5*cos(TAU*u_t)))/0.045, 2.0));
  col += vec3(0.30,0.80,0.86)*inside*fall*(0.05 + 0.07*breath + 0.13*band);
  col += vec3(1.0,0.82,0.52)*glow(p, vec2(1478.0,366.0), 95.0)*(0.14+0.14*breath);
  col += vec3(1.0,0.75,0.4)*glow(p, vec2(1476.0,700.0), 60.0)*w*(0.05+0.06*breath);
  // boat lantern (moves with the boat)
  float flick = 0.72 + 0.16*sin(TAU*u_t*7.0) + 0.12*sin(TAU*u_t*13.0+1.3);
  vec2 lp = vec2(255.0,715.0) + vec2(-a*60.0, lift);
  col += vec3(1.0,0.60,0.20)*(glow(p,lp,78.0)*0.30 + glow(p,lp,22.0)*0.35)*flick;
  col += vec3(1.0,0.60,0.20)*glow(p, vec2(275.0,850.0), 70.0)*w*0.16*flick;
  // buoy lights, in order toward the lighthouse
  col += beacon(p, vec2(687.0,672.0), vec3(0.62,0.34,0.95), 0.0, 3.2*sin(TAU*(u_t*3.0+0.10)));
  col += beacon(p, vec2(898.0,632.0), vec3(0.45,0.42,1.0), 1.0, 2.6*sin(TAU*(u_t*3.0+0.38)));
  col += beacon(p, vec2(1034.0,610.0), vec3(0.20,0.66,1.0), 2.0, 2.0*sin(TAU*(u_t*3.0+0.61)));
  col += beacon(p, vec2(1138.0,592.0), vec3(0.55,0.97,1.0), 3.0, 1.5*sin(TAU*(u_t*3.0+0.83)));
  // stars: the painted five, plus a few faint ones
  col += star(p, vec2(207.0,76.0), 2.0, 0.0) + star(p, vec2(86.0,163.0), 3.0, 0.3) + star(p, vec2(1019.0,223.0), 2.0, 0.55)
       + star(p, vec2(1443.0,71.0), 4.0, 0.2) + star(p, vec2(1572.0,147.0), 3.0, 0.7)
       + 0.6*(star(p, vec2(520.0,120.0), 3.0, 0.45) + star(p, vec2(760.0,58.0), 2.0, 0.85) + star(p, vec2(1210.0,140.0), 5.0, 0.1)
            + star(p, vec2(380.0,250.0), 4.0, 0.62) + star(p, vec2(1320.0,250.0), 2.0, 0.33) + star(p, vec2(930.0,110.0), 3.0, 0.9));
  gl_FragColor = vec4(col, 1.0);
}
`;
