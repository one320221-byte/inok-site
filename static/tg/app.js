/* INOK Mini App. Один экран со свечой и пять вкладок. Данные приходят из /api/tg/me одним объектом. */
(() => {
  "use strict";
  const tg = window.Telegram && window.Telegram.WebApp;
  const $app = document.getElementById("app");
  const $tabs = document.getElementById("tabs");
  const $sheet = document.getElementById("sheet");
  const $sheetBody = $sheet.querySelector(".sheet");
  const $toast = document.getElementById("toast");

  let S = null;            // текущее состояние с сервера
  let tab = "home";
  let platform = null;     // выбранная платформа на вкладке «Подключить»
  let planPick = null;     // выбранный тариф
  let lang = "ru";

  const t = (ru, en) => (lang === "en" ? en : ru);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const haptic = (kind = "light") => { try { kind === "ok" || kind === "error" ? tg.HapticFeedback.notificationOccurred(kind === "ok" ? "success" : "error") : tg.HapticFeedback.impactOccurred(kind); } catch (e) {} };
  const months = { ru: ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"],
                   en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"] };
  const date = (ts) => { const d = new Date(ts * 1000); return lang === "en" ? `${months.en[d.getMonth()]} ${d.getDate()}` : `${d.getDate()} ${months.ru[d.getMonth()]}`; };
  const plural = (n, one, few, many) => { const a = n % 10, b = n % 100; return a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 10 || b >= 20) ? few : many; };
  const daysWord = (n) => t(plural(n, "день", "дня", "дней"), n === 1 ? "day" : "days");
  const gb = (bytes) => (bytes / 1073741824).toFixed(bytes > 10 * 1073741824 ? 0 : 1);
  const planOf = (code) => (S.plans || []).find((p) => p.code === code);
  const planTitle = (code) => { const p = planOf(code); return p ? t(p.title, p.title_en) : code; };

  function toast(text) {
    $toast.textContent = text;
    $toast.classList.add("show");
    clearTimeout(toast.tm);
    toast.tm = setTimeout(() => $toast.classList.remove("show"), 2200);
  }

  function open(url) {
    if (!url) return;
    if (tg && /^https:\/\/t\.me\//.test(url)) tg.openTelegramLink(url);
    else if (tg && /^https?:/.test(url)) tg.openLink(url);
    else location.href = url;  // happ://, v2raytun:// и т.п.
  }

  async function copy(text, label) {
    try { await navigator.clipboard.writeText(text); }
    catch (e) {
      const ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } catch (_) {}
      ta.remove();
    }
    haptic("ok");
    toast(label || t("Скопировано", "Copied"));
  }

  async function api(path, opts = {}) {
    const headers = { "X-Init-Data": tg ? tg.initData : "" };
    if (opts.json) { headers["Content-Type"] = "application/json"; opts.body = JSON.stringify(opts.json); }
    const r = await fetch(path, { method: opts.method || "GET", headers, body: opts.body });
    let data = null;
    try { data = await r.json(); } catch (e) {}
    if (!r.ok) { const err = new Error((data && (data.error || data.detail)) || String(r.status)); err.status = r.status; err.data = data; throw err; }
    return data;
  }

  // ---------- свеча ----------
  function candle(daysLeft, lit) {
    const top = 66, bottom = 196, min = 14;
    const h = lit ? Math.max(min, Math.round((bottom - top) * Math.min(daysLeft / 30, 1))) : min;
    const y = bottom - h;
    const flame = lit
      ? `<ellipse class="halo" cx="56" cy="${y - 22}" rx="34" ry="38" fill="url(#halo)"/>
         <path class="flame" d="M56 ${y - 46} C63 ${y - 34} 68 ${y - 26} 68 ${y - 18} C68 ${y - 10} 62 ${y - 5} 56 ${y - 5} C50 ${y - 5} 44 ${y - 10} 44 ${y - 18} C44 ${y - 26} 49 ${y - 34} 56 ${y - 46}Z" fill="url(#fl)"/>
         <path class="flame" d="M56 ${y - 30} C59 ${y - 24} 61 ${y - 20} 61 ${y - 16} C61 ${y - 12} 59 ${y - 10} 56 ${y - 10} C53 ${y - 10} 51 ${y - 12} 51 ${y - 16} C51 ${y - 20} 53 ${y - 24} 56 ${y - 30}Z" fill="#fff4d6"/>`
      : `<path class="smoke" d="M56 ${y - 8} C50 ${y - 22} 62 ${y - 30} 56 ${y - 44} C51 ${y - 56} 60 ${y - 62} 57 ${y - 72}" fill="none" stroke="#8F8B82" stroke-width="2" stroke-linecap="round"/>`;
    return `<svg class="candle" viewBox="0 0 112 210" role="img" aria-label="${esc(lit ? t(`Свеча: осталось ${daysLeft} ${daysWord(daysLeft)}`, `Candle: ${daysLeft} ${daysWord(daysLeft)} left`) : t("Свеча погасла", "The candle is out"))}">
      <defs>
        <radialGradient id="halo"><stop offset="0" stop-color="#F0B44C" stop-opacity=".55"/><stop offset="1" stop-color="#F0B44C" stop-opacity="0"/></radialGradient>
        <linearGradient id="fl" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#F0B44C"/><stop offset="1" stop-color="#c9822a"/></linearGradient>
        <linearGradient id="wx" x1="0" x2="1"><stop offset="0" stop-color="#cfcabf"/><stop offset=".45" stop-color="#E6E3DC"/><stop offset="1" stop-color="#a9a499"/></linearGradient>
      </defs>
      ${flame}
      <rect x="55" y="${y - 7}" width="2" height="8" rx="1" fill="#2a2723"/>
      <rect class="wax" x="38" y="${y}" width="36" height="${h}" rx="5" fill="url(#wx)"/>
      ${lit && h > 30 ? `<path d="M44 ${y + 2} q-2 14 1 22" stroke="#fff" stroke-opacity=".35" stroke-width="3" fill="none" stroke-linecap="round"/>` : ""}
      <ellipse cx="56" cy="200" rx="40" ry="6" fill="#1a1815"/>
      <rect x="18" y="194" width="76" height="6" rx="3" fill="#2a2723"/>
    </svg>`;
  }

  // ---------- вкладки ----------
  const TABS = [
    ["home", "Доступ", "Access", '<path class="fl" d="M12 3c2 3 4 5 4 7.5a4 4 0 0 1-8 0C8 8 10 6 12 3Z" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="9" y="15" width="6" height="6" rx="1" fill="none" stroke="currentColor" stroke-width="1.6"/>'],
    ["connect", "Подключить", "Connect", '<rect x="7" y="3" width="10" height="18" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M11 18h2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>'],
    ["plans", "Тарифы", "Plans", '<path d="M4 7h16v11H4z M4 11h16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>'],
    ["friends", "Друзья", "Friends", '<circle cx="9" cy="9" r="3.2" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="16.5" cy="10" r="2.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M3.5 19c.8-3 3-4.5 5.5-4.5s4.7 1.5 5.5 4.5M15 14.6c2.4 0 4.3 1.3 5 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>'],
    ["more", "Ещё", "More", '<circle cx="6" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="18" cy="12" r="1.6" fill="currentColor"/>'],
  ];

  function renderTabs() {
    $tabs.hidden = false;
    $tabs.innerHTML = TABS.map(([id, ru, en, icon]) =>
      `<button class="tab ${tab === id ? "on" : ""}" data-tab="${id}" aria-current="${tab === id ? "page" : "false"}"><svg viewBox="0 0 24 24" aria-hidden="true">${icon}</svg>${t(ru, en)}</button>`).join("");
  }

  function go(id) {
    if (tab !== id) haptic("light");
    tab = id;
    render();
    window.scrollTo(0, 0);
  }

  // ---------- экраны ----------
  function screenHome() {
    const a = S.account;
    const now = Math.floor(Date.now() / 1000);
    const active = a && a.active;
    const left = active ? Math.max(1, Math.ceil((a.expires_at - now) / 86400)) : 0;
    let vigil;
    if (active) {
      vigil = `<span class="state"><i></i>${t("Доступ открыт", "Access is on")}</span>
        <div class="big">${left}<small>${daysWord(left)}</small></div>
        <div class="until">${t("до", "until")} ${date(a.expires_at)}</div>`;
    } else if (a && a.expires_at) {
      vigil = `<span class="state"><i></i>${t("Срок закончился", "Expired")}</span>
        <h2>${t("Свеча погасла", "The candle is out")}</h2>
        <p>${t(`Доступ закончился ${date(a.expires_at)}. Продлите, и всё заработает с той же ссылкой.`, `Access ended on ${date(a.expires_at)}. Renew and the same link works again.`)}</p>`;
    } else {
      vigil = `<span class="state"><i></i>${t("Нет доступа", "No access yet")}</span>
        <h2>${t("Зажгите свечу", "Light the candle")}</h2>
        <p>${S.trial_available ? t(`Попробуйте бесплатно: ${S.trial.days} ${daysWord(S.trial.days)} и ${S.trial.gb} ГБ трафика, без оплаты.`, `Try it free: ${S.trial.days} ${daysWord(S.trial.days)} and ${S.trial.gb} GB, no payment.`) : t("Выберите тариф, и доступ откроется сразу после проверки оплаты.", "Pick a plan and access opens as soon as we check the payment.")}</p>`;
    }
    let html = `<div class="head"><h1>INOK</h1><span class="sub">${esc(S.user.name)}</span></div>
      <section class="altar ${active ? "" : "out"}">${candle(left, active)}<div class="vigil">${vigil}</div></section>`;

    if (a && a.live && active) {
      const L = a.live;
      html += `<div class="meters">
        <div class="meter"><b><span class="dot ${L.online ? "on" : ""}"></span>${L.online ? t("в сети", "online") : t("тихо", "idle")}</b><span>${t("сейчас", "right now")}</span></div>
        <div class="meter"><b>${L.devices || 0}/${S.device_limit || "∞"}</b><span>${t("устройства", "devices")}</span></div>
        <div class="meter"><b>${gb(L.traffic_used)}</b><span>${L.traffic_limit_gb ? t(`из ${L.traffic_limit_gb} ГБ`, `of ${L.traffic_limit_gb} GB`) : t("ГБ, без лимита", "GB, no cap")}</span></div>
      </div>`;
    }

    const pend = (a && a.pending) || [];
    html += pend.map((p) => p.status === "review"
      ? `<div class="card pending" style="margin-top:14px"><span class="orb" aria-hidden="true"></span><div><b>${t("Проверяем оплату", "Checking your payment")} #${p.id}</b><div class="muted small">${planTitle(p.plan)}, ${p.amount} ₽. ${t("Обычно это занимает до 30 минут. Бот напишет, когда доступ откроется.", "Usually within 30 minutes. The bot will message you when access opens.")}</div></div></div>`
      : `<button class="card pending" style="margin-top:14px;width:100%;text-align:left" data-act="resume" data-id="${p.id}"><span class="orb" aria-hidden="true"></span><div style="flex:1"><b>${t("Заказ ждёт оплаты", "Order awaiting payment")} #${p.id}</b><div class="muted small">${planTitle(p.plan)}, ${p.amount} ₽. ${t("Нажмите, чтобы продолжить.", "Tap to continue.")}</div></div></button>`).join("");

    html += `<div class="stack">`;
    if (active) {
      html += `<button class="btn btn-gold" data-tab="connect">${t("Подключить устройство", "Connect a device")}</button>
               <button class="btn btn-line" data-tab="plans">${t("Продлить", "Renew")}</button>`;
    } else {
      if (S.trial_available) html += `<button class="btn btn-gold" data-act="trial">${t("Попробовать бесплатно", "Try it free")}</button>`;
      html += `<button class="btn ${S.trial_available ? "btn-line" : "btn-gold"}" data-tab="plans">${t("Выбрать тариф", "Choose a plan")}</button>`;
    }
    html += `</div>`;

    html += `<ul class="feat">
      <li>${t("Протокол VLESS Reality: трафик выглядит как обычный сайт", "VLESS Reality: traffic looks like a regular website")}</li>
      <li>${t(`До ${S.device_limit} устройств на одну подписку`, `Up to ${S.device_limit} devices per subscription`)}</li>
      <li>${t("Российские сайты открываются напрямую, без VPN", "Russian sites open directly, bypassing the VPN")}</li>
    </ul>`;
    return html;
  }

  function guessPlatform() {
    const p = (tg && tg.platform) || "";
    if (p === "ios") return "ios";
    if (p === "android" || p === "android_x") return "android";
    if (p === "macos") return "macos";
    if (/Windows/i.test(navigator.userAgent)) return "windows";
    if (/Mac/i.test(navigator.userAgent)) return "macos";
    if (/Linux/i.test(navigator.userAgent) && !/Android/i.test(navigator.userAgent)) return "linux";
    return "android";
  }

  function screenConnect() {
    const a = S.account;
    let html = `<div class="head"><h1>${t("Подключить", "Connect")}</h1></div>`;
    if (!a || !a.sub_url) {
      return html + `<div class="card"><p style="margin:0 0 14px">${t("Ссылка для подключения появится, как только откроется доступ: после пробного дня или оплаты.", "Your connection link appears once access opens: after the free day or a payment.")}</p>
        <button class="btn btn-gold" data-tab="${S.trial_available ? "home" : "plans"}">${S.trial_available ? t("Получить пробный день", "Get the free day") : t("Выбрать тариф", "Choose a plan")}</button></div>`;
    }
    platform = platform || guessPlatform();
    const P = S.platforms.find((p) => p.id === platform) || S.platforms[0];
    html += `<div class="chips" role="tablist">${S.platforms.map((p) => `<button class="chip ${p.id === P.id ? "on" : ""}" data-plat="${p.id}" role="tab" aria-selected="${p.id === P.id}">${esc(t(p.ru, p.en))}</button>`).join("")}</div>`;
    html += `<p class="note">${esc(t(P.note_ru, P.note_en))}</p>`;
    html += `<div class="block">` + P.apps.map((ap, i) => {
      const add = a.add && a.add[ap.id];
      const how = t(ap.how_ru, ap.how_en) || [];
      return `<div class="card app-item">
        <div class="app-ico" aria-hidden="true">${esc(ap.name[0])}</div>
        <div>
          <h4>${esc(ap.name)}${i === 0 ? `<span class="tag">${t("советуем", "pick")}</span>` : ""}</h4>
          <p>${esc(t(ap.ru, ap.en))}</p>
          <div class="app-acts">
            <button class="btn btn-line btn-sm" data-open="${esc(ap.url)}">${t("Установить", "Install")} · ${esc(ap.store)}</button>
            ${add ? `<button class="btn btn-gold btn-sm" data-open="${esc(add)}">${t("Добавить подписку", "Add subscription")}</button>` : `<button class="btn btn-gold btn-sm" data-copy="${esc(a.sub_url)}">${t("Скопировать ссылку", "Copy link")}</button>`}
          </div>
          ${i === 0 ? `<ol class="steps">${how.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>`
            : `<details class="faq" style="border:0;padding:10px 0 0"><summary class="small muted">${t("Как подключить", "How to connect")}</summary><ol class="steps">${how.map((s) => `<li>${esc(s)}</li>`).join("")}</ol></details>`}
        </div>
      </div>`;
    }).join("") + `</div>`;

    html += `<div class="block"><h3>${t("Ссылка-подписка", "Subscription link")}</h3>
      <button class="copy" data-copy="${esc(a.sub_url)}">${esc(a.sub_url)}<em>${t("Копировать", "Copy")}</em></button>
      ${a.qr ? `<p class="muted small" style="margin:14px 2px 10px">${t("С другого устройства удобнее отсканировать:", "From another device, just scan it:")}</p><div class="qr">${a.qr}</div>` : ""}
    </div>`;

    if (a.ext_key) html += extBlock(a);
    return html;
  }

  function extBlock(a) {
    return `<div class="block"><h3>${t("Расширение для Chrome", "Chrome extension")}</h3>
      <div class="card">
        <p class="muted small" style="margin:0 0 12px">${t("Только для браузера на компьютере, без приложений. Установите расширение INOK и введите этот ключ.", "Browser only, no apps needed. Install the INOK extension and enter this key.")}</p>
        <button class="copy" data-copy="${esc(a.ext_key)}">${esc(a.ext_key)}<em>${t("Копировать", "Copy")}</em></button>
        <div class="stack"><button class="btn btn-line" data-open="${esc(S.app_url + "/ext")}">${t("Как установить расширение", "How to install it")}</button></div>
      </div></div>`;
  }

  function screenPlans() {
    const a = S.account;
    planPick = planPick || (S.plans[1] || S.plans[0]).code;
    let html = `<div class="head"><h1>${t("Тарифы", "Plans")}</h1><span class="sub">${a && a.active ? t("дни прибавятся к сроку", "days add to your term") : ""}</span></div>`;
    html += S.plans.map((p, i) => `<button class="plan ${p.code === planPick ? "pick" : ""}" data-plan="${p.code}" aria-pressed="${p.code === planPick}">
        <span class="t">${esc(t(p.title, p.title_en))}${i === 1 ? `<span class="tag">${t("выгодно", "best value")}</span>` : ""}</span>
        <span class="p">${p.old ? `<s>${p.old} ₽</s>` : ""}${p.price} ₽</span>
        <span class="n">${p.days} ${daysWord(p.days)}. ${esc(t(p.note, p.note_en))}</span>
      </button>`).join("");
    const p = planOf(planPick);
    html += `<div class="stack"><button class="btn btn-gold" data-act="order">${t("Оплатить", "Pay")} ${p ? p.price : ""} ₽</button></div>`;
    html += `<p class="muted small" style="margin:10px 4px 0">${t("Перевод по реквизитам на карту или по СБП. После перевода прикрепите чек, и мы откроем доступ.", "Bank transfer by card or SBP. Attach the receipt afterwards and we open access.")}</p>`;
    html += `<div class="block"><h3>${t("Промокод", "Promo code")}</h3>
      ${S.promo ? `<p class="note" style="margin:0 2px 12px">${t(`Скидка ${S.promo.value}% по коду ${esc(S.promo.code)} уже в ценах.`, `${S.promo.value}% off with ${esc(S.promo.code)} is already applied.`)}</p>` : ""}
      <form class="field" data-form="promo"><input name="code" autocomplete="off" maxlength="32" placeholder="${t("Введите код", "Enter a code")}" aria-label="${t("Промокод", "Promo code")}"><button class="btn btn-line" type="submit">${t("Применить", "Apply")}</button></form></div>`;
    html += `<ul class="feat">
      <li>${t("Без ограничения скорости", "No speed limits")}</li>
      <li>${t(`До ${S.device_limit} устройств`, `Up to ${S.device_limit} devices`)}</li>
      <li>${t("Напоминание за 3 дня и за день до конца срока", "Reminders 3 days and 1 day before expiry")}</li>
    </ul>`;
    return html;
  }

  function screenFriends() {
    const a = S.account;
    let html = `<div class="head"><h1>${t("Друзья", "Friends")}</h1></div>`;
    if (!a || !a.ref) {
      return html + `<div class="card"><p style="margin:0 0 14px">${t("Пригласительная ссылка появится, когда у вас будет аккаунт: после пробного дня или оплаты.", "Your invite link appears once you have an account: after the free day or a payment.")}</p><button class="btn btn-gold" data-tab="home">${t("На главную", "Home")}</button></div>`;
    }
    const R = a.ref;
    const share = `https://t.me/share/url?url=${encodeURIComponent(R.link)}&text=${encodeURIComponent(t("INOK: быстрый VPN, который не режут. По моей ссылке первый день бесплатно.", "INOK: a fast VPN that doesn't get blocked. First day free with my link."))}`;
    html += `<section class="altar" style="grid-template-columns:1fr">
        <div class="vigil"><span class="state"><i></i>${t("Неделя за друга", "A week per friend")}</span>
        <div class="ref-num" style="margin-top:12px">${R.count}</div>
        <p>${t(`${plural(R.count, "друг оплатил", "друга оплатили", "друзей оплатили")} доступ. За каждого вам +${R.bonus} ${daysWord(R.bonus)}.`, `friends paid. You get +${R.bonus} days for each.`)}</p></div>
      </section>
      <div class="stack">
        <button class="btn btn-gold" data-open="${esc(share)}">${t("Отправить другу", "Send to a friend")}</button>
        <button class="copy" data-copy="${esc(R.link)}">${esc(R.link)}<em>${t("Копировать", "Copy")}</em></button>
      </div>
      <ol class="steps" style="margin:20px 2px 0;font-size:14px">
        <li>${t("Друг открывает бота по вашей ссылке.", "Your friend opens the bot via your link.")}</li>
        <li>${t("Оплачивает любой тариф.", "They pay for any plan.")}</li>
        <li>${t(`Вам сразу прибавляется ${R.bonus} ${daysWord(R.bonus)}.`, `You get ${R.bonus} days right away.`)}</li>
      </ol>`;
    return html;
  }

  const FAQ = [
    ["Не подключается. Что делать?", "It won't connect. What now?", "Обновите подписку в приложении (обычно кнопка со стрелками), выберите другой сервер и переподключитесь. Не помогло: напишите в поддержку, ответим.", "Refresh the subscription in the app (usually a circular-arrows button), pick another server and reconnect. Still stuck? Message support."],
    ["Можно на нескольких устройствах?", "Can I use several devices?", "Да, одна ссылка работает на всех ваших устройствах в пределах лимита. Просто добавьте её в приложение на каждом.", "Yes, one link works on all your devices up to the limit. Add it to the app on each one."],
    ["Сайты банков и Госуслуги работают?", "Do Russian bank sites work?", "Да, российские сайты идут напрямую, мимо VPN, поэтому банки и госсервисы не ругаются.", "Yes, Russian sites go directly, bypassing the VPN, so banks and public services work fine."],
    ["Сколько ждать после оплаты?", "How long after paying?", "Обычно до 30 минут: мы проверяем чек вручную. Как только одобрим, бот пришлёт сообщение, а срок обновится здесь.", "Usually up to 30 minutes: we check receipts by hand. Once approved the bot messages you and the term updates here."],
    ["Вы храните логи?", "Do you keep logs?", "Нет. Мы не храним историю посещений, только срок доступа и объём трафика для лимитов.", "No. We don't keep browsing history, only your term and traffic volume for limits."],
  ];

  function screenMore() {
    const a = S.account;
    const row = (ic, ru, en, sub, attrs) => `<button class="list-btn" ${attrs}><span class="ic" aria-hidden="true">${ic}</span><span class="tx">${t(ru, en)}${sub ? `<small>${sub}</small>` : ""}</span><span class="go" aria-hidden="true">›</span></button>`;
    let html = `<div class="head"><h1>${t("Ещё", "More")}</h1></div>`;
    if (a) {
      html += `<div class="card"><p class="muted small" style="margin:0 0 6px">${t("Номер аккаунта. По нему можно войти на сайте.", "Account number. Use it to sign in on the website.")}</p>
        <button class="copy" data-copy="${esc(a.id.replace(/ /g, ""))}" style="font-size:18px;letter-spacing:.06em">${esc(a.id)}<em>${t("Копировать", "Copy")}</em></button></div>`;
    }
    html += `<div class="card" style="margin-top:10px;padding:4px 14px">
      ${row("✦", "Поддержка", "Support", "@" + esc(S.support), `data-open="https://t.me/${esc(S.support)}"`)}
      ${row("◉", "Канал INOK", "INOK channel", "@" + esc(S.channel), `data-open="https://t.me/${esc(S.channel)}"`)}
      ${S.app_url ? row("⧉", "Расширение для Chrome", "Chrome extension", t("VPN прямо в браузере", "VPN right in the browser"), `data-open="${esc(S.app_url)}/ext"`) : ""}
      ${S.app_url ? row("⌂", "Кабинет на сайте", "Account on the website", t("вход по номеру аккаунта", "sign in with your account number"), `data-open="${esc(S.app_url)}/login"`) : ""}
    </div>`;
    if (a && a.history && a.history.length) {
      html += `<div class="block"><h3>${t("Платежи", "Payments")}</h3><div class="card"><dl class="kv" style="margin:0">${a.history.map((p) =>
        `<dt>#${p.id} · ${date(p.at)}</dt><dd>${planTitle(p.plan)}, ${p.amount} ₽ — ${p.status === "approved" ? t("принят", "accepted") : t("отклонён", "declined")}</dd>`).join("")}</dl></div></div>`;
    }
    html += `<div class="block"><h3>${t("Вопросы", "Questions")}</h3>${FAQ.map(([qr, qe, ar, ae]) => `<details class="faq"><summary>${t(qr, qe)}</summary><p>${t(ar, ae)}</p></details>`).join("")}</div>`;
    html += `<div class="stack"><button class="btn btn-line btn-sm" style="width:100%" data-act="lang">${t("Switch to English", "Перейти на русский")}</button></div>`;
    return html;
  }

  // ---------- оплата ----------
  function openSheet(html) {
    $sheetBody.innerHTML = html;
    $sheet.hidden = false;
    document.body.style.overflow = "hidden";
    if (tg) { tg.BackButton.show(); }
  }
  function closeSheet() {
    $sheet.hidden = true;
    document.body.style.overflow = "";
    if (tg) tg.BackButton.hide();
  }

  function paySheet(p) {
    const R = S.requisites;
    const reqRow = (label, value, copyVal) => value ? `<dt>${label}</dt><dd><button class="copy" data-copy="${esc(copyVal || value)}">${esc(value)}<em>${t("Копировать", "Copy")}</em></button></dd>` : "";
    openSheet(`<h2>${t("Заказ", "Order")} #${p.id}</h2>
      <p class="muted" style="margin:0">${planTitle(p.plan)}</p>
      <div class="order-sum">${p.amount} ₽</div>
      <button class="btn btn-line btn-sm" data-copy="${p.amount}">${t("Скопировать сумму", "Copy amount")}</button>
      <dl class="kv" style="grid-template-columns:1fr">
        ${reqRow(t("Карта", "Card"), R.card ? R.card.replace(/(\d{4})(?=\d)/g, "$1 ") : "", R.card)}
        ${reqRow(t("СБП, телефон", "SBP phone"), R.sbp)}
        ${R.bank ? `<dt>${t("Банк", "Bank")}</dt><dd>${esc(R.bank)}</dd>` : ""}
        ${R.holder ? `<dt>${t("Получатель", "Recipient")}</dt><dd>${esc(R.holder)}</dd>` : ""}
      </dl>
      <p class="note">${t("Переведите ровно эту сумму, в комментарии ничего не пишите. Потом прикрепите чек или скриншот перевода.", "Transfer exactly this amount and leave the comment empty. Then attach the receipt or a screenshot.")}</p>
      <label class="drop" style="margin-top:16px;position:relative">
        <input type="file" accept="image/*,.pdf,.heic" data-receipt="${p.id}">
        <b>${t("Прикрепить чек", "Attach receipt")}</b>
        <span>${t("Фото, скриншот или PDF, до 5 МБ", "Photo, screenshot or PDF, up to 5 MB")}</span>
      </label>
      <div class="stack"><button class="btn btn-line btn-sm" style="width:100%" data-act="cancel" data-id="${p.id}">${t("Отменить заказ", "Cancel order")}</button></div>`);
  }

  async function uploadReceipt(pid, file) {
    if (file.size > 5 * 1024 * 1024) { haptic("error"); return toast(t("Файл больше 5 МБ", "File is over 5 MB")); }
    const label = $sheetBody.querySelector(".drop b");
    if (label) label.textContent = t("Отправляем…", "Sending…");
    const fd = new FormData();
    fd.append("receipt", file, file.name || "receipt.jpg");
    try {
      S = await api(`/api/tg/pay/${pid}/receipt`, { method: "POST", body: fd });
      haptic("ok");
      closeSheet();
      tab = "home";
      render();
      toast(t("Чек отправлен. Проверим и откроем доступ.", "Receipt sent. We'll check it and open access."));
    } catch (e) {
      haptic("error");
      if (label) label.textContent = t("Прикрепить чек", "Attach receipt");
      toast(e.message === "file" ? t("Нужен файл JPG, PNG, WEBP, HEIC или PDF", "Use JPG, PNG, WEBP, HEIC or PDF") : t("Не получилось отправить, попробуйте ещё раз", "Upload failed, try again"));
    }
  }

  // ---------- действия ----------
  const actions = {
    async trial(btn) {
      btn.disabled = true;
      try { S = await api("/api/tg/trial", { method: "POST" }); haptic("ok"); toast(t("Готово! Свеча горит.", "Done! The candle is lit.")); tab = "connect"; render(); }
      catch (e) { haptic("error"); btn.disabled = false; toast(e.status === 409 ? t("Пробный день уже использован", "Free day already used") : t("Не получилось, попробуйте позже", "Something went wrong, try later")); }
    },
    async order(btn) {
      btn.disabled = true;
      try { const p = await api("/api/tg/order", { method: "POST", json: { plan: planPick } }); haptic("medium"); paySheet(p); refresh(); }
      catch (e) { toast(e.status === 503 ? t("Оплата временно недоступна, напишите в поддержку", "Payments are paused, contact support") : t("Не получилось создать заказ", "Couldn't create the order")); }
      btn.disabled = false;
    },
    resume(btn) {
      const p = (S.account.pending || []).find((x) => String(x.id) === btn.dataset.id);
      if (p) paySheet(p);
    },
    async cancel(btn) {
      btn.disabled = true;
      try { S = await api(`/api/tg/pay/${btn.dataset.id}/cancel`, { method: "POST" }); closeSheet(); render(); toast(t("Заказ отменён", "Order cancelled")); }
      catch (e) { btn.disabled = false; }
    },
    lang() { lang = lang === "en" ? "ru" : "en"; render(); },
    async recheck(btn) {
      btn.disabled = true;
      await refresh();
      if (S.need_sub) { haptic("error"); toast(t("Подписка пока не видна. Подпишитесь и нажмите ещё раз.", "We can't see the subscription yet. Subscribe and try again.")); btn.disabled = false; }
      else haptic("ok");
    },
  };

  async function applyPromo(form) {
    const input = form.code;
    const code = input.value.trim();
    if (!code) return input.focus();
    const btn = form.querySelector("button");
    btn.disabled = true;
    try {
      const r = await api("/api/tg/promo", { method: "POST", json: { code } });
      S = r.state;
      haptic("ok");
      render();
      toast(r.kind === "days" ? t(`+${r.value} ${daysWord(r.value)} к сроку`, `+${r.value} days added`) : t(`Скидка ${r.value}% применена`, `${r.value}% off applied`));
    } catch (e) {
      haptic("error");
      btn.disabled = false;
      const why = e.data && e.data.error;
      toast({ nf: t("Такого кода нет", "No such code"), old: t("Код истёк", "Code expired"), out: t("Код закончился", "Code is used up"), used: t("Вы уже использовали этот код", "You've already used this code") }[why] || t("Не получилось применить код", "Couldn't apply the code"));
    }
  }

  // ---------- отрисовка ----------
  function gate() {
    $tabs.hidden = true;
    $app.innerHTML = `<div class="gate fade-in">
      ${candle(0, false)}
      <h1>${t("Сначала подпишитесь на канал", "Subscribe to the channel first")}</h1>
      <p>${t("Там новости, новые серверы и промокоды. После подписки откроется всё приложение.", "News, new servers and promo codes live there. Subscribe and the whole app opens.")}</p>
      <div class="stack">
        <button class="btn btn-gold" data-open="https://t.me/${esc(S.channel)}">${t("Открыть канал", "Open the channel")} @${esc(S.channel)}</button>
        <button class="btn btn-line" data-act="recheck">${t("Я подписался", "I've subscribed")}</button>
      </div></div>`;
  }

  function outside() {
    $tabs.hidden = true;
    $app.innerHTML = `<div class="gate">
      ${candle(0, false)}
      <h1>${t("Откройте INOK в Telegram", "Open INOK in Telegram")}</h1>
      <p>${t("Это приложение работает внутри Telegram: так мы узнаём вас без паролей.", "This app runs inside Telegram, so we know it's you without passwords.")}</p>
      <div class="stack"><a class="btn btn-gold" href="https://t.me/inokvpn_bot">${t("Открыть бота", "Open the bot")}</a><a class="btn btn-line" href="/login">${t("Войти на сайте по номеру", "Sign in on the website")}</a></div></div>`;
  }

  function render() {
    if (!S) return;
    if (S.need_sub) return gate();
    const screens = { home: screenHome, connect: screenConnect, plans: screenPlans, friends: screenFriends, more: screenMore };
    $app.innerHTML = `<div class="fade-in">${screens[tab]()}</div>`;
    renderTabs();
  }

  async function refresh() {
    try { S = await api("/api/tg/me"); lang = refresh.langSet ? lang : (S.user.lang === "en" ? "en" : "ru"); refresh.langSet = true; render(); loadLive(); }
    catch (e) {
      $tabs.hidden = true;
      $app.innerHTML = `<div class="gate"><h1>${t("Нет связи с INOK", "Can't reach INOK")}</h1><p>${e.status === 401 ? t("Сессия устарела. Закройте и откройте приложение заново.", "Session expired. Close and reopen the app.") : t("Проверьте интернет и попробуйте ещё раз.", "Check your connection and try again.")}</p><div class="stack"><button class="btn btn-gold" data-act="reload">${t("Повторить", "Retry")}</button></div></div>`;
    }
  }
  actions.reload = () => location.reload();

  // онлайн, трафик и устройства приходят отдельно: панель отвечает не мгновенно
  async function loadLive() {
    if (!S || S.need_sub || !S.account || !S.account.has_panel) return;
    try {
      const r = await api("/api/tg/live");
      if (!r.live || !S.account) return;
      S.account.live = r.live;
      if (r.live.sub_changed) return refresh();
      if (tab === "home") render();
    } catch (e) {}
  }

  // ---------- события ----------
  document.addEventListener("click", (ev) => {
    const el = ev.target.closest("[data-tab],[data-act],[data-copy],[data-open],[data-plat],[data-plan],[data-close]");
    if (!el) return;
    if (el.dataset.close !== undefined) return closeSheet();
    if (el.dataset.copy !== undefined) return copy(el.dataset.copy);
    if (el.dataset.open) { haptic("light"); return open(el.dataset.open); }
    if (el.dataset.tab) return go(el.dataset.tab);
    if (el.dataset.plat) { platform = el.dataset.plat; haptic("light"); return render(); }
    if (el.dataset.plan) { planPick = el.dataset.plan; haptic("light"); return render(); }
    if (el.dataset.act && actions[el.dataset.act]) return actions[el.dataset.act](el);
  });
  document.addEventListener("submit", (ev) => {
    if (ev.target.dataset.form === "promo") { ev.preventDefault(); applyPromo(ev.target); }
  });
  document.addEventListener("change", (ev) => {
    const inp = ev.target;
    if (inp.dataset && inp.dataset.receipt && inp.files && inp.files[0]) uploadReceipt(inp.dataset.receipt, inp.files[0]);
  });
  document.addEventListener("visibilitychange", () => { if (!document.hidden && S) refresh(); });

  // ---------- старт ----------
  if (!tg || !tg.initData) {
    lang = (navigator.language || "ru").startsWith("ru") ? "ru" : "en";
    return outside();
  }
  tg.ready();
  tg.expand();
  try { tg.setHeaderColor("#000000"); tg.setBackgroundColor("#000000"); tg.setBottomBarColor && tg.setBottomBarColor("#000000"); } catch (e) {}
  try { tg.disableVerticalSwipes && tg.disableVerticalSwipes(); } catch (e) {}
  tg.BackButton.onClick(closeSheet);
  const sp = tg.initDataUnsafe && tg.initDataUnsafe.start_param;
  if (sp && ["connect", "plans", "friends", "more"].includes(sp)) tab = sp;
  refresh();
})();
