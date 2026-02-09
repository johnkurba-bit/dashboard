const express = require("express");
const session = require("express-session");
const passport = require("passport");
const DiscordStrategy = require("passport-discord").Strategy;
require("dotenv").config();

// Node < 18 ما فيه fetch افتراضي. هذا polyfill يشتغل على كل النسخ.
const fetchFn =
  global.fetch ||
  ((...args) =>
    import("node-fetch").then(({ default: fetch }) => fetch(...args)));

const app = express();

// ✅ مهم على Render/Proxy عشان OAuth ما يلخبط https
app.set("trust proxy", 1);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ===== Compute safe callback URL =====
const BASE_URL = (process.env.BASE_URL || "").replace(/\/+$/, "");
const DISCORD_CALLBACK =
  (process.env.DISCORD_CALLBACK_URL || "").trim() ||
  (process.env.DISCORD_REDIRECT_URI || "").trim() ||
  (BASE_URL ? `${BASE_URL}/auth/callback` : "");

// ===== Sessions =====
app.use(
  session({
    secret: process.env.SESSION_SECRET || "change_me",
    resave: false,
    saveUninitialized: false,
    // اختياري: إذا بدك تشددها:
    // cookie: { secure: "auto", sameSite: "lax" },
  })
);

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

passport.use(
  new DiscordStrategy(
    {
      clientID: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
      callbackURL: DISCORD_CALLBACK, // ✅ fix
      scope: ["identify"],
    },
    (accessToken, refreshToken, profile, done) => done(null, profile)
  )
);

const PORT = Number(process.env.PORT || 3000);

// مهم: على Replit غالباً البورت الخارجي مربوط على 8080.
// لوحة التحكم شغّالة على 3000 (Preview داخلي)، والبوت API على 8080.
// لذلك الافضل تكون قيمة BOT_API_BASE داخلياً: http://127.0.0.1:8080
const API_BASE = (process.env.BOT_API_BASE || "http://127.0.0.1:8080").replace(
  /\/+$/,
  ""
);
const API_KEY = process.env.BOT_API_KEY || "";

// ===== Site access control =====
// SITE_PRIVATE=1  => ما حدا بيفتح أي صفحة قبل تسجيل دخول ديسكورد
// SITE_ADMIN_ONLY=1 => حتى بعد تسجيل الدخول لازم يكون Admin عشان يفتح أي صفحة (حتى /)
const SITE_PRIVATE = String(process.env.SITE_PRIVATE ?? "0") === "1";
const SITE_ADMIN_ONLY = String(process.env.SITE_ADMIN_ONLY ?? "0") === "1";

function esc(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ===== SVG ICONS (Global) =====
// كلها inline SVG مع currentColor عشان تمشي مع الثيم
const icons = {
  dashboard: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 13h8V3H3v10z"/><path d="M13 21h8V11h-8v10z"/><path d="M13 3h8v6h-8z"/><path d="M3 17h8v4H3z"/></svg>`,
  settings: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"/><path d="M19.4 15a7.9 7.9 0 0 0 .1-2l2-1.5-2-3.5-2.4 1a8 8 0 0 0-1.7-1L15 3H9l-.4 3a8 8 0 0 0-1.7 1l-2.4-1-2 3.5 2 1.5a7.9 7.9 0 0 0 .1 2l-2 1.5 2 3.5 2.4-1a8 8 0 0 0 1.7 1l.4 3h6l.4-3a8 8 0 0 0 1.7-1l2.4 1 2-3.5-2-1.5z"/></svg>`,
  balance: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h18v10H3z"/><path d="M7 11h.01"/><path d="M17 13h.01"/><path d="M12 15a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/></svg>`,
  shop: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 7h15l-1.5 9h-13z"/><path d="M6 7l-2-3H2"/><path d="M9 22a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"/><path d="M18 22a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"/></svg>`,
  xp: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.7 6.2 6.8.6-5.2 4.5 1.6 6.7L12 16.9 6.1 20l1.6-6.7L2.5 8.8l6.8-.6L12 2z"/></svg>`,
  logs: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/></svg>`,
  admins: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l8 4v6c0 5-3.4 9.4-8 10-4.6-.6-8-5-8-10V6l8-4z"/><path d="M9 12l2 2 4-5"/></svg>`,
  logout: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/><path d="M21 3v18"/></svg>`,
  menu: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/></svg>`,
  search: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16z"/><path d="M21 21l-4.3-4.3"/></svg>`,
  save: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/></svg>`,
  add: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14"/><path d="M5 12h14"/></svg>`,
  edit: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>`,
  delete: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M6 6l1 16h10l1-16"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>`,
  user: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 21a8 8 0 1 0-16 0"/><path d="M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"/></svg>`,
  role: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l3 7 7 .5-5.4 4.4 1.8 7.1L12 17.8 5.6 21l1.8-7.1L2 9.5 9 9l3-7z"/></svg>`
};

function layout(req, title, body) {
  const user = req.user;
  const isLogged = !!user;
  const path = (req.path || "/").toLowerCase();

  const navItem = (href, label, iconKey, danger = false) => {
    const active =
      href === "/dashboard"
        ? path === "/dashboard"
        : path === href || path.startsWith(href + "/");
    return `<a href="${href}" class="${active ? "active" : ""} ${
      danger ? "danger" : ""
    }"><span class="ico">${icons[iconKey] || ""}</span><span>${esc(
      label
    )}</span></a>`;
  };

  const nav = isLogged
    ? `
  <aside class="side" id="side">
    <div class="brand">
      <div class="logoDot"></div>
      <div>
        <div class="brandTitle">YKZ Control</div>
        <div class="brandSub">Admin dashboard</div>
      </div>
    </div>
    <nav class="nav">
      ${navItem("/dashboard", "Dashboard", "dashboard")}
      ${navItem("/settings", "Settings", "settings")}
      ${navItem("/balance", "Balance", "balance")}
      ${navItem("/shop", "Shop", "shop")}
      ${navItem("/xp", "XP", "xp")}
      ${navItem("/logs", "Logs", "logs")}
      ${navItem("/admins", "Admins", "admins")}
      <div class="navSep"></div>
      ${navItem("/logout", "Logout", "logout", true)}
    </nav>
  </aside>`
    : "";

  const avatarUrl = user?.id
    ? `https://cdn.discordapp.com/avatars/${encodeURIComponent(
        user.id
      )}/${encodeURIComponent(user.avatar || "")}.png?size=64`
    : "";

  const top = isLogged
    ? `<div class="topbar">
        <button class="iconBtn mobileOnly" id="menuBtn" type="button" aria-label="Menu">${icons.menu}</button>
        <div class="crumbs">
          <div class="title">${esc(title)}</div>
          <div class="sub">Live view • ${esc(new Date().toLocaleString())}</div>
        </div>
        <div class="who">
          ${
            user?.avatar
              ? `<img class="avatar" src="${esc(avatarUrl)}" alt="avatar" onerror="this.style.display='none'"/>`
              : ""
          }
          <div class="whoText">
            <div class="whoName">${esc(user.username)}#${esc(
        user.discriminator
      )}</div>
            <div class="whoId">ID: ${esc(user.id)}</div>
          </div>
        </div>
      </div>`
    : "";

  return `<!doctype html>
<html lang="ar">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title>
<style>
  /* (نفس CSS اللي عندك) */
  @keyframes fadeUp { from { opacity:0; transform: translateY(10px);} to { opacity:1; transform: translateY(0);} }
  @keyframes pop { 0%{ transform: scale(.96); opacity:0;} 100%{ transform: scale(1); opacity:1;} }
  @keyframes shimmer { 0%{ background-position: 0% 50%; } 100%{ background-position: 100% 50%; } }
  .enter { animation: fadeUp .45s ease both; }
  .card { animation: fadeUp .55s ease both; }
  .ico svg, .chip svg, .iconBtn svg {
    width: 18px; height: 18px;
    stroke: currentColor; fill: none;
    stroke-width: 1.8;
    stroke-linecap: round; stroke-linejoin: round;
    display: block;
  }
  .chip svg { width: 16px; height: 16px; }
  .iconBtn svg { width: 20px; height: 20px; }
  a, button { transition: transform .15s ease, background .15s ease, border-color .15s ease, box-shadow .15s ease, opacity .15s ease; }
  .btn:hover { transform: translateY(-1px); box-shadow: 0 16px 40px rgba(0,0,0,.35); }
  .btn:active { transform: translateY(0); }
  .side a .ico { transition: transform .18s ease; }
  .side a:hover .ico { transform: translateX(2px); }
  .chip { background-size: 200% 200%; background-image: linear-gradient(120deg, rgba(139,92,246,.18), rgba(34,211,238,.16), rgba(139,92,246,.18)); animation: shimmer 6s ease infinite; }

  :root{
    --bg0:#070812;
    --bg1:#0b1020;
    --card:rgba(255,255,255,.055);
    --card2:rgba(255,255,255,.085);
    --text:#f8fafc;
    --muted:rgba(248,250,252,.72);
    --line:rgba(255,255,255,.10);
    --accent:#8b5cf6;
    --accent2:#22d3ee;
    --good:#22c55e;
    --danger:#ef4444;
    --warn:#f59e0b;
    --shadow: 0 22px 70px rgba(0,0,0,.48);
    --radius: 18px;
  }
  *{box-sizing:border-box}
  html,body{height:100%}
  body{
    margin:0;
    font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, "Noto Sans Arabic", "Noto Sans", Arial, "Apple Color Emoji","Segoe UI Emoji";
    color:var(--text);
    background:
      radial-gradient(900px 520px at 12% 8%, rgba(139,92,246,.38), transparent 62%),
      radial-gradient(900px 520px at 88% 26%, rgba(34,211,238,.20), transparent 62%),
      radial-gradient(900px 520px at 55% 92%, rgba(167,139,250,.16), transparent 62%),
      linear-gradient(180deg,var(--bg0),var(--bg1));
  }
  a{color:inherit; text-decoration:none}
  .wrap{display:flex; min-height:100%}
  .side{
    width:292px; padding:18px 14px; position:sticky; top:0; height:100vh;
    background: linear-gradient(180deg, rgba(255,255,255,.07), rgba(255,255,255,.03));
    border-right:1px solid var(--line);
    backdrop-filter: blur(14px);
  }
  .brand{
    display:flex; gap:12px; align-items:center;
    padding:14px 14px; margin:6px 6px 14px;
    border:1px solid var(--line); border-radius:16px;
    background: linear-gradient(135deg, rgba(139,92,246,.28), rgba(34,211,238,.10));
    box-shadow: 0 10px 30px rgba(0,0,0,.25);
  }
  .logoDot{
    width:14px; height:14px; border-radius:999px;
    background: radial-gradient(circle at 30% 30%, rgba(255,255,255,.9), rgba(255,255,255,.1));
    box-shadow: 0 0 0 6px rgba(34,211,238,.12), 0 0 0 12px rgba(139,92,246,.10);
  }
  .brandTitle{font-weight:900; letter-spacing:.3px; font-size:16px; line-height:1.1}
  .brandSub{font-size:12px; color: rgba(248,250,252,.78)}
  .nav a{
    display:flex; align-items:center; gap:10px;
    padding:11px 12px; margin:6px; border-radius:14px;
    color:var(--muted);
    border:1px solid transparent;
    transition: .15s ease;
  }
  .nav a .ico{
    width:18px; height:18px; display:inline-flex; align-items:center; justify-content:center;
    color: rgba(248,250,252,.78);
  }
  .nav a:hover{
    color:var(--text);
    border-color: var(--line);
    background: rgba(255,255,255,.06);
    transform: translateY(-1px);
  }
  .nav a.active{
    color:var(--text);
    border-color: rgba(139,92,246,.45);
    background: linear-gradient(135deg, rgba(139,92,246,.18), rgba(34,211,238,.08));
  }
  .navSep{height:1px; margin:12px 10px; background: rgba(255,255,255,.10)}
  .main{flex:1; padding:24px 26px}
  /* ... (باقي الـ CSS مثل ما عندك بالضبط) ... */
</style>
</head>
<body>
${nav ? `<div class="overlay" id="overlay"></div><div id="toastHost" class="toastHost"></div><div class="wrap">${nav}<main class="main enter">${top}${body}</main></div>` : `<div id="toastHost" class="toastHost"></div><main class="main enter">${body}</main>`}
<script>
  (function(){
    var btn = document.getElementById('menuBtn');
    var side = document.getElementById('side');
    var ov = document.getElementById('overlay');
    function openMenu(){ if(side) side.classList.add('open'); if(ov) ov.classList.add('show'); }
    function closeMenu(){ if(side) side.classList.remove('open'); if(ov) ov.classList.remove('show'); }
    if(btn && side && ov){
      btn.addEventListener('click', function(){ side.classList.contains('open') ? closeMenu() : openMenu(); });
      ov.addEventListener('click', closeMenu);
    }
  })();
</script>
</body>
</html>`;
}

async function safeJson(r) {
  const t = await r.text();
  try { return JSON.parse(t); } catch (e) { return { ok: false, status: r.status, raw: t }; }
}

async function apiGet(path) {
  try {
    const r = await fetchFn(`${API_BASE}${path}`, {
      headers: { "X-API-KEY": API_KEY },
    });
    return await safeJson(r);
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}

async function apiPost(path, body) {
  try {
    const r = await fetchFn(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-KEY": API_KEY },
      body: JSON.stringify(body || {}),
    });
    return await safeJson(r);
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}
function isOk(result){
  if(!result) return false;
  if(result.ok === true) return true;
  if(result.status === "ok") return true;
  return false;
}

function redirectToast(res, path, result, okMsg, errMsg){
  const ok = isOk(result);
  const extra = result && (result.error || result.raw) ? `: ${(result.error || result.raw)}` : "";
  const msg = ok ? okMsg : (errMsg + extra);
  const u = `${path}?toast=${encodeURIComponent(String(msg).slice(0, 400))}&type=${ok ? "ok" : "err"}`;
  return res.redirect(u);
}

function requireLogin(req, res, next) {
  if (!req.user) return res.redirect("/");
  next();
}

async function requireAdmin(req, res, next) {
  if (!req.user) return res.redirect("/");
  const now = Date.now();
  if (req.session.adminCheckedAt && now - req.session.adminCheckedAt < 30000) {
    if (req.session.isAdmin) return next();
    return res.status(403).send(layout(req, "No Access", `<div class="card"><h1>🚫 لا تملك صلاحية</h1><p class="msg">لازم تكون أدمن.</p></div>`));
  }
  try {
    const data = await apiGet(`/api/auth/is_admin?user_id=${encodeURIComponent(req.user.id)}`);
    req.session.adminCheckedAt = now;
    req.session.isAdmin = !!data.is_admin;
    if (req.session.isAdmin) return next();
    return res.status(403).send(layout(req, "No Access", `<div class="card"><h1>🚫 لا تملك صلاحية</h1><p class="msg">لازم تكون أدمن.</p></div>`));
  } catch (e) {
    return res.status(500).send(layout(req, "Error", `<div class="card"><h1>API Error</h1><p class="msg">${esc(e.message)}</p></div>`));
  }
}

// ===== Global lock (optional) =====
app.use((req, res, next) => {
  if (!SITE_PRIVATE) return next();
  const openPaths = new Set(["/", "/check", "/login", "/auth/callback"]);
  if (openPaths.has(req.path)) return next();
  if (req.path === "/logout") return next();
  if (!req.user) return res.redirect("/login");
  if (SITE_ADMIN_ONLY) return requireAdmin(req, res, next);
  return next();
});

// Public Home
app.get("/", (req, res) => {
  const body = `
  <div class="card">
    <h1>YKZ Control Panel</h1>
    <p class="msg">لوحة تحكم الإدارة.</p>
    <div class="row">
      ${req.user ? `<a href="/dashboard"><button>Open Dashboard</button></a>` : `<a href="/login"><button>Login with Discord</button></a>`}
    </div>
  </div>`;
  res.send(layout(req, "YKZ Control Panel", body));
});

app.get("/check", async (req, res) => {
  try {
    const health = await apiGet("/api/health");
    let isAdmin = false;
    let roleId = null;
    if (req.user?.id) {
      const adminResp = await apiGet(`/api/auth/is_admin?user_id=${encodeURIComponent(req.user.id)}`);
      isAdmin = !!adminResp?.is_admin;
      roleId = adminResp?.admin_role_id || null;
    }
    res.json({
      ok: true,
      health,
      logged_in: !!req.user,
      discord_id: req.user?.id || null,
      is_admin: isAdmin,
      admin_role_id: roleId,
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

app.get("/login", passport.authenticate("discord"));

app.get(
  "/auth/callback",
  passport.authenticate("discord", { failureRedirect: "/" }),
  (req, res) => res.redirect("/dashboard")
);

app.get("/logout", (req, res) => {
  req.logout(() => res.redirect("/"));
});

// ✅ باقي صفحاتك (/dashboard /settings /balance /shop /xp /logs /admins ...) كما هي عندك
// لأنك أرسلت جزء كبير منها. خليه كما هو بدون تغيير.

// ⚠️ مهم: في آخر الملف لازم نطبع الرابط الصحيح
app.listen(PORT, "0.0.0.0", () => {
  const url = BASE_URL || `http://localhost:${PORT}`;
  console.log(`Dashboard running on ${url} (callback: ${DISCORD_CALLBACK || "MISSING"})`);
});
