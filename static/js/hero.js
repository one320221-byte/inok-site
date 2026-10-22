// Монах INOK в капюшоне, перерисованный упорядоченным дизерингом (Байер 8×8).
// Курсор — свеча: пиксели рядом с ней загораются тёплым светом и дрожат вместе с пламенем.
// При скролле фигура рассыпается вверх, как дым.
(() => {
  const el = document.getElementById("hero-canvas");
  if (!el) return;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl", { antialias: false, premultipliedAlpha: false });
  if (!gl) return;
  el.appendChild(canvas);

  const vs = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0., 1.); }`;
  const fs = `
precision highp float;
uniform sampler2D uTex;
uniform vec2 uRes, uMouse;
uniform float uTime, uProgress, uIntro, uCell, uFlame;
uniform vec4 uRect;

float bayer2(vec2 a){ a = floor(a); return fract(dot(a, vec2(.5, a.y * .75))); }
float bayer4(vec2 a){ return bayer2(.5 * a) * .25 + bayer2(a); }
float bayer8(vec2 a){ return bayer4(.5 * a) * .25 + bayer2(a); }
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

void main(){
  vec2 cell = floor(gl_FragCoord.xy / uCell);
  vec2 c = (cell + .5) * uCell;
  float r = hash(cell);

  // дым: клетка берёт цвет из точки ниже себя и чуть вбок
  float p = uProgress * uProgress;
  vec2 dir = vec2((hash(cell + 3.1) - .5) * .6 + sin(c.y * .01 + uTime) * .15 * p, hash(cell + 7.7) * .8 + .2);
  vec2 sp = c - dir * p * uRes.y * .8 * r;
  vec2 uv = (sp - uRect.xy) / uRect.zw;

  float l = 0.;
  if (uv.x > 0. && uv.x < 1. && uv.y > 0. && uv.y < 1.) {
    l = dot(texture2D(uTex, uv).rgb, vec3(.299, .587, .114));
  }

  float d = length(c - uMouse) / uRes.y;
  float lamp = exp(-d * d * 11.) * uFlame;
  l = l * (.5 + .9 * lamp) + lamp * .06;

  l *= smoothstep(0., 1., uIntro * 1.5 - r * .5);
  l *= 1. - smoothstep(.5, 1., uProgress * (.55 + r * .6));

  float t = bayer8(cell) * .92 + .04 + (hash(cell + floor(uTime * 9.)) - .5) * .05;
  float on = step(t, l);

  vec3 ink = vec3(0.);
  vec3 bone = vec3(.902, .89, .863);
  vec3 candle = vec3(.941, .706, .298);
  vec3 lit = mix(bone, candle, smoothstep(.15, .75, lamp));
  gl_FragColor = vec4(mix(ink, lit, on), 1.);
}`;

  const sh = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s));
    return s;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(prog);
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const U = {};
  ["uTex", "uRes", "uMouse", "uTime", "uProgress", "uIntro", "uCell", "uFlame", "uRect"].forEach(
    (n) => (U[n] = gl.getUniformLocation(prog, n))
  );

  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 1, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0]));
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const img = new Image();
  img.onload = () => {
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
  };
  img.src = "/static/img/inok.jpg";

  const state = { intro: reduce ? 1 : 0, progress: 0 };
  const target = { x: 0, y: 0 }, lamp = { x: 0, y: 0 };
  let rest = { x: 0, y: 0 }, W = 0, H = 0, dpr = 1, hasPointer = false;

  const layout = () => {
    dpr = Math.min(devicePixelRatio || 1, 2);
    const w = el.clientWidth, h = el.clientHeight;
    W = Math.round(w * dpr); H = Math.round(h * dpr);
    canvas.width = W; canvas.height = H;
    gl.viewport(0, 0, W, H);
    const mobile = w < 768;
    const size = mobile ? Math.min(W * 1.1, H * 0.62) : Math.min(H * 1.02, W * 0.72);
    const cx = mobile ? W * 0.5 : W * 0.68;
    const y0 = mobile ? H - size * 1.0 : (H - size) * 0.25;
    gl.uniform4f(U.uRect, cx - size / 2, y0, size, size);
    gl.uniform1f(U.uCell, Math.max(3 * dpr, Math.round((size / 200) * 0.5) * 2));
    gl.uniform2f(U.uRes, W, H);
    rest = { x: cx, y: y0 + size * 0.72 };
    if (!hasPointer) { target.x = lamp.x = rest.x; target.y = lamp.y = rest.y; }
  };
  layout();
  new ResizeObserver(layout).observe(el);

  addEventListener("pointermove", (e) => {
    const b = el.getBoundingClientRect();
    hasPointer = e.pointerType === "mouse";
    target.x = (e.clientX - b.left) * dpr;
    target.y = (b.height - (e.clientY - b.top)) * dpr;
  });

  if (window.gsap) {
    if (!reduce) gsap.to(state, { intro: 1, duration: 2.6, ease: "power2.out", delay: 0.15 });
    if (window.ScrollTrigger) {
      ScrollTrigger.create({
        trigger: el.parentElement, start: "top top", end: "bottom top", scrub: true,
        onUpdate: (s) => (state.progress = reduce ? 0 : s.progress),
      });
    }
  } else state.intro = 1;

  let visible = true;
  new IntersectionObserver(([en]) => (visible = en.isIntersecting)).observe(el);

  const frame = (ms) => {
    requestAnimationFrame(frame);
    if (!visible) return;
    const t = ms / 1000;
    if (!hasPointer && !reduce) {
      target.x = rest.x + Math.sin(t * 0.4) * H * 0.12;
      target.y = rest.y + Math.cos(t * 0.3) * H * 0.07;
    }
    lamp.x += (target.x - lamp.x) * 0.08;
    lamp.y += (target.y - lamp.y) * 0.08;
    // пламя: два синуса и немного шума, чтобы свет не был ровным
    const flame = reduce ? 1 : 0.9 + Math.sin(t * 7.3) * 0.05 + Math.sin(t * 13.1) * 0.03 + (Math.random() - 0.5) * 0.04;
    gl.uniform2f(U.uMouse, lamp.x, lamp.y);
    gl.uniform1f(U.uTime, reduce ? 0 : t);
    gl.uniform1f(U.uProgress, state.progress);
    gl.uniform1f(U.uIntro, state.intro);
    gl.uniform1f(U.uFlame, flame);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  requestAnimationFrame(frame);
})();
