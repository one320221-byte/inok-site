// Моушен и мелочи интерфейса для всех страниц INOK.
(() => {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const en = document.documentElement.lang === "en";
  const hasGsap = !!window.gsap;
  const ST = window.ScrollTrigger;
  if (hasGsap && ST) gsap.registerPlugin(ST);
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const store = {
    get: (k) => { try { return sessionStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { sessionStorage.setItem(k, v); } catch {} },
  };

  // ---------- плавный скролл ----------
  // Перезагрузка открывает страницу сверху: иначе скрытые до прокрутки блоки мигают чёрным.
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  if (!location.hash) window.scrollTo(0, 0);
  let lenis = null;
  if (!reduce && window.Lenis && hasGsap) {
    lenis = new Lenis({ lerp: 0.1 });
    if (ST) lenis.on("scroll", ST.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  $$('a[href^="/#"], a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href").split("#")[1];
      const target = id && document.getElementById(id);
      if (!target) return;
      e.preventDefault();
      if (lenis) lenis.scrollTo(target, { offset: -40 }); else target.scrollIntoView();
      history.replaceState(null, "", "#" + id);
    });
  });

  // ---------- текст «расшифровывается» из случайных знаков ----------
  const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+<>/";
  function scramble(el, text = el.dataset.text || el.textContent, dur = 600) {
    if (reduce) { el.textContent = text; return; }
    el.dataset.text = text;
    const start = performance.now();
    cancelAnimationFrame(el._raf);
    const tick = (now) => {
      const p = Math.min(1, (now - start) / dur);
      const done = Math.floor(p * text.length);
      el.textContent = text.split("").map((ch, i) =>
        i < done || ch === " " ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0]).join("");
      if (p < 1) el._raf = requestAnimationFrame(tick); else el.textContent = text;
    };
    el._raf = requestAnimationFrame(tick);
  }
  $$("[data-scramble-hover]").forEach((el) => {
    const host = el.closest("a") || el;
    host.addEventListener("mouseenter", () => scramble(el, el.dataset.text || el.textContent, 420));
  });

  // ---------- заголовки по словам ----------
  function splitWords(el) {
    if (el.dataset.splitDone) return $$(".sw > i", el);
    el.dataset.splitDone = "1";
    el.innerHTML = el.textContent.trim().split(/\s+/).map((w) => `<span class="sw"><i>${w}</i></span>`).join(" ");
    return $$(".sw > i", el);
  }

  // ---------- первый экран ----------
  function heroIntro() {
    const letters = $$(".wm-l");
    if (!letters.length || !hasGsap || reduce) return;
    gsap.from(letters, { yPercent: 115, rotate: 8, opacity: 0, duration: 1.5, ease: "expo.out", stagger: 0.08 });
    gsap.from(".hero-lead, .hero-sub, .hero-actions, .node", { opacity: 0, y: 18, duration: 1, ease: "power3.out", stagger: 0.08, delay: 0.5 });
    letters.forEach((l) => l.addEventListener("mouseenter", () => {
      const ch = l.dataset.ch;
      let n = 0;
      const id = setInterval(() => {
        l.textContent = ++n > 6 ? ch : GLYPHS[(Math.random() * 26) | 0];
        if (n > 6) clearInterval(id);
      }, 45);
    }));
    // буквы чуть тянутся за курсором, у каждой своя глубина
    if (fine) {
      const movers = letters.map((l, i) => ({ x: gsap.quickTo(l, "x", { duration: 0.9, ease: "power3" }), k: (i + 1) * 6 }));
      addEventListener("pointermove", (e) => {
        const dx = e.clientX / innerWidth - 0.5;
        movers.forEach((m) => m.x(dx * m.k));
      });
    }
  }

  // ---------- прелоадер (первый визит) и шторка (переходы) ----------
  const pre = $("#pre");
  const curtain = $("#curtain");
  const isHome = document.body.classList.contains("home");
  function afterLoad() {
    heroIntro();
    splitOnLoad();
  }
  if (hasGsap && !reduce && pre && isHome && !store.get("inok-seen")) {
    store.set("inok-seen", "1");
    pre.classList.add("is-run");
    const n = $("#pre-n");
    const c = { v: 0 };
    gsap.timeline({ onComplete: () => pre.remove() })
      .from(".pre-word", { opacity: 0, scale: 0.92, duration: 0.8, ease: "power2.out" }, 0)
      .to(c, { v: 100, duration: 1.4, ease: "power2.inOut", onUpdate: () => (n.textContent = String(Math.round(c.v)).padStart(3, "0")) }, 0)
      .to("#pre-line", { scaleX: 1, duration: 1.4, ease: "power2.inOut" }, 0)
      .to(".pre-word", { color: "#e6e3dc", duration: 0.3 }, 1.25)
      .to(".pre-count, #pre-line, .pre-word", { opacity: 0, duration: 0.3 }, 1.55)
      .to(".pre-top", { yPercent: -100, duration: 1, ease: "expo.inOut" }, 1.6)
      .to(".pre-bot", { yPercent: 100, duration: 1, ease: "expo.inOut" }, 1.6)
      .add(afterLoad, 2.0);
  } else if (hasGsap && !reduce && curtain && store.get("inok-curtain")) {
    store.set("inok-curtain", "");
    gsap.set(curtain, { scaleY: 1, transformOrigin: "top" });
    gsap.to(curtain, { scaleY: 0, duration: 0.7, ease: "expo.inOut", delay: 0.05 });
    setTimeout(afterLoad, 250);
  } else {
    afterLoad();
  }
  if (hasGsap && !reduce && curtain) {
    document.addEventListener("click", (e) => {
      const a = e.target.closest("a[href]");
      if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
      if (a.target === "_blank" || a.hasAttribute("download") || a.hasAttribute("data-no-curtain")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || (url.pathname === location.pathname && url.hash)) return;
      e.preventDefault();
      store.set("inok-curtain", "1");
      gsap.set(curtain, { transformOrigin: "bottom" });
      gsap.to(curtain, { scaleY: 1, duration: 0.55, ease: "expo.in", onComplete: () => (location.href = url.href) });
    });
    addEventListener("pageshow", (e) => { if (e.persisted) gsap.set(curtain, { scaleY: 0 }); });
  }

  function splitOnLoad() {
    // на внутренних страницах заголовок встаёт сразу, на главной по скроллу
    $$("[data-split]").forEach((el) => {
      const words = splitWords(el);
      if (!hasGsap || reduce) return;
      if (!ST || el.closest(".page")) {
        gsap.from(words, { yPercent: 110, duration: 1.1, ease: "expo.out", stagger: 0.06 });
      } else {
        gsap.from(words, { yPercent: 110, duration: 1.1, ease: "expo.out", stagger: 0.06, scrollTrigger: { trigger: el, start: "top 85%" } });
      }
    });
  }

  // ---------- магнитные кнопки ----------
  if (fine && hasGsap && !reduce) {
    $$("[data-magnet]").forEach((el) => {
      const mx = gsap.quickTo(el, "x", { duration: 0.5, ease: "power3" }), my = gsap.quickTo(el, "y", { duration: 0.5, ease: "power3" });
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        mx((e.clientX - r.left - r.width / 2) * 0.3);
        my((e.clientY - r.top - r.height / 2) * 0.4);
      });
      el.addEventListener("pointerleave", () => { gsap.to(el, { x: 0, y: 0, duration: 0.9, ease: "elastic.out(1, 0.4)" }); });
    });
  }

  // ---------- бегущая строка: быстрее и с наклоном, когда листают ----------
  const rows = $$(".tick-row");
  if (rows.length && hasGsap && !reduce) {
    const loops = rows.map((row) => {
      const track = $(".tick-track", row);
      const dir = Number(row.dataset.dir);
      return {
        track,
        tw: dir < 0
          ? gsap.to(track, { xPercent: -50, ease: "none", duration: 38, repeat: -1 })
          : gsap.fromTo(track, { xPercent: -50 }, { xPercent: 0, ease: "none", duration: 44, repeat: -1 }),
        skew: gsap.quickTo(track, "skewX", { duration: 0.5, ease: "power3" }),
      };
    });
    if (ST) ST.create({
      trigger: ".ticker", start: "top bottom", end: "bottom top",
      onUpdate: (self) => {
        const v = self.getVelocity();
        const boost = 1 + Math.min(Math.abs(v) / 250, 6);
        loops.forEach((l) => {
          gsap.to(l.tw, { timeScale: boost, duration: 0.2, overwrite: true });
          gsap.to(l.tw, { timeScale: 1, duration: 1.2, delay: 0.2 });
          l.skew(gsap.utils.clamp(-12, 12, v / -160));
        });
      },
    });
  }

  // ---------- журнал вымарывается по мере скролла ----------
  const bars = $$(".log .bar");
  if (bars.length && hasGsap && ST) {
    if (reduce) bars.forEach((b) => (b.style.transform = "scaleX(1)"));
    else gsap.to(bars, { scaleX: 1, ease: "none", stagger: 0.5, scrollTrigger: { trigger: ".vow", start: "top 55%", end: "bottom 75%", scrub: 0.6 } });
  }

  // ---------- маскировка: пакет идёт от вас до сайта ----------
  const dis = $(".disguise");
  if (dis && hasGsap && ST) {
    const packet = $("#packet"), ptext = $("#packet-t"), fill = $(".route-fill"), scan = $(".scan");
    const nodes = $$(".rn"), steps = $$(".dis-steps li");
    const xs = nodes.map((n) => parseFloat(n.style.getPropertyValue("--x")));
    // где пакет в каждый момент: стоит у узлов, между ними едет
    const keys = [[0, 0], [0.12, 0], [0.34, xs[1]], [0.56, xs[1]], [0.76, xs[2]], [0.86, xs[2]], [1, xs[3]]];
    const at = (p) => {
      for (let i = 1; i < keys.length; i++) {
        if (p <= keys[i][0]) {
          const [p0, x0] = keys[i - 1], [p1, x1] = keys[i];
          return x0 + (x1 - x0) * gsap.parseEase("power2.inOut")((p - p0) / (p1 - p0 || 1));
        }
      }
      return 1;
    };
    const labels = ["youtube.com", "TLS 1.3 · 443", en ? "HTTPS ✓ pass" : "HTTPS ✓ пропуск", "youtube.com"];
    let phase = -1;
    const render = (p) => {
      const x = at(p);
      const pad = parseFloat(getComputedStyle($(".route")).getPropertyValue("--pad")) || 6;
      packet.style.left = `calc(${pad}% + (100% - ${2 * pad}%) * ${x})`;
      fill.style.transform = `scaleX(${x})`;
      nodes.forEach((n, i) => n.classList.toggle("is-hit", x >= xs[i] - 0.001));
      scan.style.opacity = p > 0.3 && p < 0.58 ? 1 : 0;
      if (p > 0.3 && p < 0.58 && !reduce) scan.style.transform = `translateX(${Math.sin(p * 90) * 18}px)`;
      const ph = p < 0.1 ? 0 : p < 0.3 ? 1 : p < 0.66 ? 2 : 3;
      if (ph !== phase) {
        phase = ph;
        packet.classList.toggle("is-sealed", ph === 1 || ph === 2);
        scramble(ptext, labels[ph], 380);
        steps.forEach((s, i) => { s.classList.toggle("is-on", i <= ph); s.classList.toggle("is-now", i === ph); });
      }
    };
    if (reduce) render(1);
    else {
      render(0);
      ST.create({ trigger: dis, pin: ".dis-pin", start: "top top", end: "+=220%", scrub: true, onUpdate: (s) => render(s.progress) });
    }
  }

  // ---------- цифры набегают ----------
  $$("[data-count]").forEach((el) => {
    if (!hasGsap || !ST || reduce) return;
    const to = Number(el.dataset.count), from = Number(el.dataset.from || 0);
    const o = { v: from };
    el.textContent = from.toLocaleString("ru-RU");
    gsap.to(o, {
      v: to, duration: 2, ease: "power3.out",
      scrollTrigger: { trigger: el, start: "top 88%" },
      onUpdate: () => (el.textContent = Math.round(o.v).toLocaleString("ru-RU")),
    });
  });

  // ---------- шаги загораются по очереди ----------
  $$(".steps li").forEach((li, i) => {
    if (!hasGsap || !ST) return li.classList.add("is-lit");
    ST.create({ trigger: li, start: "top 75%", onEnter: () => setTimeout(() => li.classList.add("is-lit"), reduce ? 0 : i * 180) });
  });

  // ---------- строки тарифов въезжают ----------
  if (hasGsap && ST && !reduce) {
    $$(".plan").forEach((row, i) => gsap.from(row, { y: 40, opacity: 0, duration: 1, ease: "expo.out", delay: i * 0.08, scrollTrigger: { trigger: row, start: "top 92%" } }));
  }

  // ---------- приложения: платформа подставляется сама ----------
  $$("[data-plat]").forEach((box) => {
    const tabs = $$(".plat-tab", box), ink = $(".plat-ink", box);
    const moveInk = (t) => { ink.style.width = t.offsetWidth + "px"; ink.style.transform = `translateX(${t.offsetLeft}px)`; };
    const select = (t, animate = true) => {
      tabs.forEach((x) => {
        const on = x === t;
        x.setAttribute("aria-selected", on);
        x.tabIndex = on ? 0 : -1;
        $("#" + x.getAttribute("aria-controls")).hidden = !on;
      });
      moveInk(t);
      t.scrollIntoView({ block: "nearest", inline: "nearest" });
      const pane = $("#" + t.getAttribute("aria-controls"));
      if (animate && hasGsap && !reduce) gsap.from($$(".app-row, .plat-note", pane), { y: 22, opacity: 0, duration: 0.7, ease: "expo.out", stagger: 0.06 });
      if (ST) ST.refresh();
    };
    tabs.forEach((t, i) => {
      t.addEventListener("click", () => select(t));
      t.addEventListener("keydown", (e) => {
        const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
        if (d) { e.preventDefault(); const n = tabs[(i + d + tabs.length) % tabs.length]; n.focus(); select(n); }
      });
    });
    const ua = navigator.userAgent;
    const mine = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ? "ios"
      : /Android/.test(ua) ? (/TV|AFT|BRAVIA|SmartTV/i.test(ua) ? "tv" : "android")
      : /Windows/.test(ua) ? "windows" : /Mac OS X|Macintosh/.test(ua) ? "macos" : /Linux|X11/.test(ua) ? "linux" : null;
    const first = tabs.find((t) => t.dataset.platId === mine) || tabs[0];
    requestAnimationFrame(() => select(first, false));
    addEventListener("resize", () => moveInk(tabs.find((t) => t.getAttribute("aria-selected") === "true")));
  });

  // ---------- вопросы раскрываются плавно ----------
  if (hasGsap && !reduce) {
    $$(".faq details").forEach((d) => {
      const s = $("summary", d), body = $(".faq-a", d);
      s.addEventListener("click", (e) => {
        e.preventDefault();
        if (d.open) {
          gsap.to(body, { height: 0, opacity: 0, duration: 0.45, ease: "power3.inOut", onComplete: () => { d.open = false; gsap.set(body, { clearProps: "all" }); ST && ST.refresh(); } });
        } else {
          d.open = true;
          gsap.fromTo(body, { height: 0, opacity: 0 }, { height: "auto", opacity: 1, duration: 0.6, ease: "expo.out", onComplete: () => ST && ST.refresh() });
        }
      });
    });
  }

  // ---------- финал: слово заливается светом снизу вверх ----------
  const fw = $("#fw-in");
  if (fw && hasGsap && ST && !reduce) {
    gsap.fromTo(fw, { clipPath: "inset(100% 0 0 0)" }, { clipPath: "inset(0% 0 0 0)", ease: "none", scrollTrigger: { trigger: ".final-word", start: "top 85%", end: "bottom 45%", scrub: 0.5 } });
  } else if (fw) fw.style.clipPath = "none";

  // ---------- живой статус сервера ----------
  const node = $("#node");
  if (node) {
    fetch("/api/status").then((r) => r.json()).then((s) => {
      const text = $(".node-text", node);
      node.classList.add(s.online ? "is-on" : "is-off");
      const msg = s.online ? (en ? "server online" : "сервер в сети") : (en ? "checking the connection" : "проверяем связь с сервером");
      scramble(text, `${s.location}: ${msg}`, 700);
    }).catch(() => {});
  }

  // ---------- копирование по клику ----------
  $$("[data-copy]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(btn.dataset.copy); } catch { return; }
      const hint = $(".copy-hint", btn);
      btn.classList.add("is-copied");
      if (hint) {
        const old = hint.textContent;
        hint.textContent = btn.dataset.copied || (en ? "Copied" : "Скопировано");
        setTimeout(() => { hint.textContent = old; btn.classList.remove("is-copied"); }, 1800);
      }
    });
  });

  // ---------- номер аккаунта проявляется из случайных цифр ----------
  const num = $("[data-reveal]");
  if (num && !reduce) {
    const final = num.textContent;
    let frame = 0;
    const id = setInterval(() => {
      frame++;
      num.textContent = final.split("").map((ch, i) => (ch === " " || i < frame / 2 ? ch : Math.floor(Math.random() * 10))).join("");
      if (frame / 2 >= final.length) { clearInterval(id); num.textContent = final; }
    }, 35);
  }

  // ---------- поле номера: группы по 4 цифры ----------
  const inp = $("input[name=number]");
  if (inp) inp.addEventListener("input", () => {
    const d = inp.value.replace(/\D/g, "").slice(0, 12);
    inp.value = d.replace(/(\d{4})(?=\d)/g, "$1 ");
  });

  // ---------- перетаскивание чека ----------
  const dz = $(".dropzone");
  if (dz) {
    const file = $("input[type=file]", dz);
    const label = $("b", dz);
    const sub = $("button[type=submit]", dz.closest("form"));
    const show = () => { if (file.files[0]) { label.textContent = file.files[0].name; sub.disabled = false; } };
    file.addEventListener("change", show);
    ["dragenter", "dragover"].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add("is-over"); }));
    ["dragleave", "drop"].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove("is-over"); }));
    dz.addEventListener("drop", (e) => { if (e.dataTransfer.files.length) { file.files = e.dataTransfer.files; show(); } });
  }

  // ---------- ожидание проверки оплаты ----------
  const wait = $("[data-poll]");
  if (wait) {
    const tick = () => fetch(wait.dataset.poll).then((r) => r.json()).then((s) => {
      if (s.status !== "review") location.reload(); else setTimeout(tick, 15000);
    }).catch(() => setTimeout(tick, 30000));
    setTimeout(tick, 15000);
  }

  // ---------- пламя в знаке клонится к курсору ----------
  const mkFlame = $(".brand-mark .mk-flame");
  if (mkFlame && fine && !reduce) {
    const mark = mkFlame.ownerSVGElement;
    addEventListener("pointermove", (e) => {
      const r = mark.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      mkFlame.style.rotate = `${Math.max(-18, Math.min(18, dx / 25))}deg`;
    }, { passive: true });
  }

  // ---------- свеча-прогресс ----------
  const taper = $(".taper");
  if (taper) {
    taper.hidden = false;
    const upd = () => {
      const max = document.documentElement.scrollHeight - innerHeight;
      const p = max > 0 ? Math.min(1, scrollY / max) : 0;
      taper.style.setProperty("--left", (1 - p * 0.85).toFixed(3));
      taper.classList.toggle("is-on", scrollY > innerHeight * 0.6);
    };
    addEventListener("scroll", upd, { passive: true });
    addEventListener("resize", upd);
    upd();
    taper.addEventListener("click", () => { if (lenis) lenis.scrollTo(0, { duration: 1.6 }); else scrollTo({ top: 0, behavior: "smooth" }); });
  }

  // ---------- сравнение: зачёркиваем бесплатные VPN построчно ----------
  const vsRows = $$(".vs-row:not(.vs-head)");
  if (vsRows.length) {
    if (hasGsap && ST && !reduce) {
      vsRows.forEach((row) => {
        const s = $(".vs-them s", row);
        gsap.fromTo(s, { "--cut": "0%" }, {
          "--cut": "100%", ease: "none",
          scrollTrigger: { trigger: row, start: "top 80%", end: "top 55%", scrub: 0.6,
            onUpdate: (st) => row.classList.toggle("is-cut", st.progress > 0.95) },
        });
      });
    } else {
      vsRows.forEach((row) => { $(".vs-them s", row).style.setProperty("--cut", "100%"); row.classList.add("is-cut"); });
    }
  }
})();
