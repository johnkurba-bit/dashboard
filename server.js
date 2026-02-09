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
// Render/Proxy support (fixes protocol detection behind reverse proxies)
app.set("trust proxy", 1);
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(
  session({
    secret: process.env.SESSION_SECRET || "change_me",
    resave: false,
    saveUninitialized: false,
  })
);

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

// IMPORTANT: Discord validates redirect_uri *exactly*; trim to avoid stray spaces/quotes.
const DISCORD_CALLBACK_URL = (process.env.DISCORD_CALLBACK_URL || "").trim();
console.log("DISCORD_CALLBACK_URL =", JSON.stringify(DISCORD_CALLBACK_URL));

passport.use(
  new DiscordStrategy(
    {
      clientID: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
      callbackURL: DISCORD_CALLBACK_URL,
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

// Bootstrap owner access: set OWNER_ID to your Discord user id.
// This prevents "No Access" for the server owner even if Bot API admin list is empty.
const OWNER_ID = String(process.env.OWNER_ID || "").trim();

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

  /* icons moved to global scope */


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

  /* ===== Animations ===== */
  @keyframes fadeUp { from { opacity:0; transform: translateY(10px);} to { opacity:1; transform: translateY(0);} }
  @keyframes pop { 0%{ transform: scale(.96); opacity:0;} 100%{ transform: scale(1); opacity:1;} }
  @keyframes shimmer { 0%{ background-position: 0% 50%; } 100%{ background-position: 100% 50%; } }
  @keyframes spin { to { transform: rotate(360deg);} }

  .enter { animation: fadeUp .45s ease both; }
  .card { animation: fadeUp .55s ease both; }
  .card:nth-child(2){ animation-delay: .05s; }
  .card:nth-child(3){ animation-delay: .10s; }
  .card:nth-child(4){ animation-delay: .15s; }

  /* SVG icons look */
  .ico svg, .chip svg, .iconBtn svg {
    width: 18px; height: 18px;
    stroke: currentColor; fill: none;
    stroke-width: 1.8;
    stroke-linecap: round; stroke-linejoin: round;
    display: block;
  }
  .chip svg { width: 16px; height: 16px; }
  .iconBtn svg { width: 20px; height: 20px; }

  /* Hover micro-interactions */
  a, button { transition: transform .15s ease, background .15s ease, border-color .15s ease, box-shadow .15s ease, opacity .15s ease; }
  .btn:hover { transform: translateY(-1px); box-shadow: 0 16px 40px rgba(0,0,0,.35); }
  .btn:active { transform: translateY(0); }
  .side a .ico { transition: transform .18s ease; }
  .side a:hover .ico { transform: translateX(2px); }
  .chip { background-size: 200% 200%; background-image: linear-gradient(120deg, rgba(139,92,246,.18), rgba(34,211,238,.16), rgba(139,92,246,.18)); animation: shimmer 6s ease infinite; }

  /* Drawer animation */
  .side { transition: transform .25s ease, opacity .25s ease; }
  .drawerBackdrop { animation: pop .18s ease both; }

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
  .nav a .ico svg{width:18px; height:18px}
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
  .nav a.danger{color: rgba(248,250,252,.75)}
  .nav a.danger:hover{border-color: rgba(239,68,68,.35); background: rgba(239,68,68,.10)}
  .navSep{height:1px; margin:12px 10px; background: rgba(255,255,255,.10)}
  .main{flex:1; padding:24px 26px}
  .topbar{
    display:flex; align-items:center; justify-content:space-between; gap:12px;
    margin:0 6px 18px;
  }
  .crumbs .title{font-size:20px; font-weight:850; letter-spacing:.2px}
  .crumbs .sub{font-size:12px; color: rgba(248,250,252,.65); margin-top:2px}
  .who{
    display:flex; align-items:center; gap:12px;
    padding:10px 12px;
    border:1px solid var(--line);
    background: rgba(255,255,255,.05);
    border-radius: 999px;
    backdrop-filter: blur(10px);
  }
  .avatar{width:34px; height:34px; border-radius:999px; border:1px solid var(--line)}
  .whoText{line-height:1.2}
  .whoName{font-size:13px; font-weight:800}
  .whoId{font-size:11px; color: rgba(248,250,252,.62)}
  .mobileOnly{display:none}
  .iconBtn{
    border:1px solid var(--line);
    background: rgba(255,255,255,.06);
    color: var(--text);
    width:42px; height:42px;
    border-radius: 14px;
    cursor:pointer;
    display:inline-flex; align-items:center; justify-content:center;
  }
  .iconBtn svg{width:20px; height:20px}
  h1{margin:0; font-size:28px; letter-spacing:.2px}
  h2{margin:0 0 10px; font-size:16px; letter-spacing:.2px}
  .card{
    border:1px solid var(--line);
    background: linear-gradient(180deg, var(--card2), var(--card));
    border-radius: var(--radius);
    padding:18px;
    box-shadow: var(--shadow);
    backdrop-filter: blur(14px);
  }
  .grid{display:grid; grid-template-columns: repeat(12, 1fr); gap:14px; margin-top:14px}
  .col3{grid-column: span 3}
  .col4{grid-column: span 4}
  .col5{grid-column: span 5}
  .col6{grid-column: span 6}
  .col7{grid-column: span 7}
  .col12{grid-column: span 12}
  /* Form grid (for consistent aligned forms) */
  .formGrid{display:grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap:14px; margin-top:14px}
  .formGrid .full{grid-column: 1 / -1}
  .formGrid .span2{grid-column: span 2}
  .formActions{display:flex; gap:10px; flex-wrap:wrap; align-items:center; margin-top:14px}
  .field label{display:block; font-size:12px; color:var(--muted); margin:0 0 6px}
  .field input, .field select, .field textarea{width:100%}
  @media (max-width: 900px){ .formGrid{grid-template-columns: 1fr 1fr} }
  @media (max-width: 560px){ .formGrid{grid-template-columns: 1fr} }
  .row{display:flex; gap:10px; flex-wrap:wrap; align-items:center}
  .msg{color:var(--muted); font-size:14px; line-height:1.6}
  .pill{
    display:inline-flex; align-items:center; gap:8px;
    padding:6px 10px; border-radius:999px;
    border:1px solid var(--line);
    background: rgba(255,255,255,.06);
    font-size:12px;
  }
  .kpi{
    display:flex; gap:12px; align-items:flex-start;
  }
  .kpi .kico{
    width:42px; height:42px; border-radius:14px;
    border:1px solid var(--line);
    background: linear-gradient(135deg, rgba(139,92,246,.22), rgba(34,211,238,.08));
    display:flex; align-items:center; justify-content:center;
    box-shadow: 0 10px 24px rgba(0,0,0,.18);
  }
  .kpi .kico svg{width:20px; height:20px}
  .kpi .kval{font-size:22px; font-weight:900; letter-spacing:.2px; margin-top:2px}
  .kpi .klabel{font-size:12px; color: rgba(248,250,252,.65); margin-top:2px}
  .kpi .ktrend{margin-top:8px; font-size:12px; color: rgba(248,250,252,.65)}
  .miniCanvas{width:100%; height:62px; display:block}
  button{
    border:1px solid rgba(139,92,246,.35);
    background: linear-gradient(135deg, rgba(139,92,246,.45), rgba(34,211,238,.14));
    color:var(--text);
    padding:10px 14px;
    border-radius: 14px;
    font-weight:800;
    cursor:pointer;
    transition:.15s ease;
    box-shadow: 0 14px 35px rgba(0,0,0,.25);
  }
  button:hover{transform: translateY(-1px); filter: brightness(1.04)}
  button.secondary{
    background: rgba(255,255,255,.05);
    border-color: var(--line);
    box-shadow:none;
  }
  button.danger{
    background: rgba(239,68,68,.12);
    border-color: rgba(239,68,68,.35);
    box-shadow:none;
  }
  input, select, textarea{
    width:100%;
    border:1px solid var(--line);
    background: rgba(255,255,255,.05);
    color:var(--text);
    padding:10px 12px;
    border-radius: 14px;
    outline:none;
  }
  input:focus, select:focus, textarea:focus{
    border-color: rgba(34,211,238,.45);
    box-shadow: 0 0 0 4px rgba(34,211,238,.10);
  }
  table{
    width:100%;
    border-collapse:separate;
    border-spacing:0;
    overflow:hidden;
    border-radius: 16px;
    border:1px solid var(--line);
    background: rgba(255,255,255,.03);
  }
  th, td{padding:12px 10px; text-align:left; font-size:14px}
  th{
    position:sticky; top:0;
    background: rgba(255,255,255,.06);
    color: var(--muted);
    border-bottom:1px solid var(--line);
    backdrop-filter: blur(10px);
  }
  tr:nth-child(even) td{background: rgba(255,255,255,.02)}
  .rtl{direction:rtl; text-align:right}

  /* Mobile drawer */
  .overlay{display:none}
  @media (max-width: 980px){
    .main{padding:16px}
    .side{
      display:block;
      position:fixed;
      left:-320px;
      top:0;
      height:100vh;
      z-index:50;
      transition: left .18s ease;
    }
    .side.open{left:0}
    .overlay{
      display:none;
      position:fixed;
      inset:0;
      background: rgba(0,0,0,.45);
      z-index:40;
      backdrop-filter: blur(2px);
    }
    .overlay.show{display:block}
    .mobileOnly{display:inline-flex}
    .who{display:none}
    .col3,.col4,.col5,.col6,.col7{grid-column: span 12}
  }

  /* nicer scrollbars */
  ::-webkit-scrollbar{height:10px; width:10px}
  ::-webkit-scrollbar-thumb{background: rgba(255,255,255,.14); border-radius:999px}
  ::-webkit-scrollbar-thumb:hover{background: rgba(255,255,255,.20)}

  /* Toast */
  .toastHost{ position:fixed; top:16px; right:16px; z-index:50; display:flex; flex-direction:column; gap:10px; width:min(420px, calc(100vw - 32px)); }
  .toast{ opacity:0; transform: translateY(-6px); transition: .22s ease; background: rgba(10,14,26,.9); border:1px solid var(--line); border-radius: 14px; box-shadow: var(--shadow); padding: 12px 12px; display:flex; align-items:flex-start; gap:10px; }
  .toast.show{ opacity:1; transform:none; }
  .toastDot{ width:10px; height:10px; border-radius:99px; margin-top:6px; background: var(--good); box-shadow: 0 0 0 6px rgba(34,197,94,.12); }
  .toast.err .toastDot{ background: var(--danger); box-shadow: 0 0 0 6px rgba(239,68,68,.14); }
  .toast.warn .toastDot{ background: var(--warn); box-shadow: 0 0 0 6px rgba(245,158,11,.16); }
  .toastMsg{ flex:1; font-weight:650; color: rgba(248,250,252,.92); line-height:1.35; }
  .toastX{ border:0; background:transparent; color: rgba(248,250,252,.65); font-size:18px; cursor:pointer; padding:0 6px; border-radius:10px; }
  .toastX:hover{ background: rgba(255,255,255,.06); color: rgba(248,250,252,.95); }

  /* Page header + tools */
  .pageHead{ display:flex; align-items:flex-end; justify-content:space-between; gap:14px; margin-bottom:14px; }
  .pageTitle{ display:flex; flex-direction:column; gap:4px; }
  .pageTitle h1{ margin:0; font-size:28px; letter-spacing:.2px; }
  .pageTitle p{ margin:0; color:var(--muted); }
  .actions{ display:flex; gap:10px; flex-wrap:wrap; justify-content:flex-end; }
  .chip{ display:inline-flex; align-items:center; gap:8px; padding:8px 10px; border-radius:999px; border:1px solid var(--line); background: rgba(255,255,255,.04); color: rgba(248,250,252,.92); font-weight:650; }
  .chip svg{ width:16px; height:16px; opacity:.9; }
  .hint{ font-size:13px; color: rgba(248,250,252,.62); }
  table tbody tr:hover{ background: rgba(255,255,255,.03); }
  .tableTools{ display:flex; gap:10px; align-items:center; justify-content:space-between; flex-wrap:wrap; margin: 10px 0 12px; }
  .tableTools input{ width:min(320px, 100%); }
  .mono{ font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-size: 12.5px; }
  .btnGhost{ border:1px solid var(--line); background: rgba(255,255,255,.03); }
  .btnGhost:hover{ background: rgba(255,255,255,.06); }
</style>
</head>
<body>
${nav ? `<div class="overlay" id="overlay"></div><div id="toastHost" class="toastHost"></div><div class="wrap">${nav}<main class="main enter">${top}${body}</main></div>` : `<div id="toastHost" class="toastHost"></div><main class="main enter">${body}</main>`}
<script>
  (function(){
    // Mobile menu
    var btn = document.getElementById('menuBtn');
    var side = document.getElementById('side');
    var ov = document.getElementById('overlay');
    function openMenu(){ if(side) side.classList.add('open'); if(ov) ov.classList.add('show'); }
    function closeMenu(){ if(side) side.classList.remove('open'); if(ov) ov.classList.remove('show'); }
    if(btn && side && ov){
      btn.addEventListener('click', function(){ side.classList.contains('open') ? closeMenu() : openMenu(); });
      ov.addEventListener('click', closeMenu);
    }

    // Toast
    function showToast(msg, type){
      if(!msg) return;
      var host = document.getElementById('toastHost');
      if(!host){
        host = document.createElement('div');
        host.id = 'toastHost';
        document.body.appendChild(host);
      }
      host.className = 'toastHost';
      var t = document.createElement('div');
      t.className = 'toast ' + (type === 'err' ? 'err' : (type === 'warn' ? 'warn' : 'ok'));
      t.innerHTML = '<div class="toastDot"></div><div class="toastMsg"></div><button class="toastX" aria-label="Close">×</button>';
      t.querySelector('.toastMsg').textContent = msg;
      t.querySelector('.toastX').addEventListener('click', function(){ t.remove(); });
      host.appendChild(t);
      setTimeout(function(){ t.classList.add('show'); }, 10);
      setTimeout(function(){ t.classList.remove('show'); setTimeout(function(){ t.remove(); }, 220); }, 4200);
    }

    try{
      var u = new URL(window.location.href);
      var toast = u.searchParams.get('toast');
      var type = u.searchParams.get('type') || 'ok';
      if(toast){
        showToast(toast, type);
        u.searchParams.delete('toast'); u.searchParams.delete('type');
        window.history.replaceState({}, document.title, u.pathname + (u.searchParams.toString() ? '?' + u.searchParams.toString() : '') + u.hash);
      }
    }catch(e){}

    // Confirm hooks
    document.addEventListener('submit', function(e){
      var f = e.target;
      var msg = f && f.getAttribute && f.getAttribute('data-confirm');
      if(msg && !window.confirm(msg)){ e.preventDefault(); }
    }, true);
    document.addEventListener('click', function(e){
      var el = e.target && e.target.closest ? e.target.closest('[data-confirm-click]') : null;
      if(el){
        var msg = el.getAttribute('data-confirm-click') || 'Are you sure?';
        if(!window.confirm(msg)) e.preventDefault();
      }
    }, true);

    // Copy buttons
    document.addEventListener('click', function(e){
      var b = e.target && e.target.closest ? e.target.closest('[data-copy]') : null;
      if(!b) return;
      var txt = b.getAttribute('data-copy') || '';
      if(!txt) return;
      navigator.clipboard.writeText(txt).then(function(){
        showToast('Copied: ' + txt, 'ok');
      }).catch(function(){
        showToast('Copy failed', 'err');
      });
    });

    // Simple table filter: input[data-filter="#tableId"]
    document.addEventListener('input', function(e){
      var inp = e.target;
      if(!inp || !inp.matches || !inp.matches('input[data-filter]')) return;
      var sel = inp.getAttribute('data-filter');
      var table = sel ? document.querySelector(sel) : null;
      if(!table) return;
      var q = (inp.value || '').toLowerCase().trim();
      var rows = table.querySelectorAll('tbody tr');
      rows.forEach(function(r){
        var txt = (r.innerText || '').toLowerCase();
        r.style.display = !q || txt.includes(q) ? '' : 'none';
      });
    });
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

  // Owner bypass (bootstrap)
  if (OWNER_ID && String(req.user.id) === OWNER_ID) {
    req.session.adminCheckedAt = Date.now();
    req.session.isAdmin = true;
    return next();
  }
  // cache in session for 30s
  const now = Date.now();
  if (req.session.adminCheckedAt && now - req.session.adminCheckedAt < 30000) {
    if (req.session.isAdmin) return next();
    return res.status(403).send(layout(req, "No Access", `<div class="card"><h1>🚫 لا تملك صلاحية</h1><p class="msg">لازم تكون أدمن (حسب رتبة الأدمن أو الأدمنز اللي أضفتهم من الداشبورد).</p></div>`));
  }
  try {
    const data = await apiGet(`/api/auth/is_admin?user_id=${encodeURIComponent(req.user.id)}`);
    req.session.adminCheckedAt = now;
    req.session.isAdmin = !!data.is_admin;
    if (req.session.isAdmin) return next();
    return res.status(403).send(layout(req, "No Access", `<div class="card"><h1>🚫 لا تملك صلاحية</h1><p class="msg">لازم تكون أدمن (حسب رتبة الأدمن أو الأدمنز اللي أضفتهم من الداشبورد).</p></div>`));
  } catch (e) {
    return res.status(500).send(layout(req, "Error", `<div class="card"><h1>API Error</h1><p class="msg">${esc(e.message)}</p></div>`));
  }
}

// ===== Global lock (optional) =====
// لو SITE_PRIVATE=1: أي صفحة (عدا / و /check) تحتاج Login
// لو SITE_ADMIN_ONLY=1: أي صفحة تحتاج Admin بعد Login
app.use((req, res, next) => {
  if (!SITE_PRIVATE) return next();

  // مسارات لازم تظل مفتوحة عشان تسجيل الدخول يشتغل
  const openPaths = new Set(["/", "/check", "/login", "/auth/callback"]);
  if (openPaths.has(req.path)) return next();

  // logout لازم يشتغل حتى لو ضايل session
  if (req.path === "/logout") return next();

  if (!req.user) return res.redirect("/login");

  if (SITE_ADMIN_ONLY) {
    // requireAdmin async
    return requireAdmin(req, res, next);
  }

  return next();
});

// Public Home
app.get("/", (req, res) => {
  const body = `
  <div class="card">
    <h1>YKZ Control Panel</h1>
    <p class="msg">لوحة تحكم الإدارة. ${SITE_PRIVATE ? "الدخول للوحة التحكم مقفول (يتطلب Login) — لكن الصفحة الرئيسية مفتوحة." : "الموقع مفتوح، ولوحة التحكم فقط للأدمن."}</p>
    <div class="row">
      ${req.user ? `<a href="/dashboard"><button>Open Dashboard</button></a>` : `<a href="/login"><button>Login with Discord</button></a>`}
    </div>
  </div>`;
  res.send(layout(req, "YKZ Control Panel", body));
});

// صفحة فحص سريعة للتأكد أن الـ Bot API شغّال وأن تسجيل الدخول ماسك.
// افتح: /check
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
      ok: true,      health,
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

// Dashboard
app.get("/dashboard", requireLogin, requireAdmin, async (req, res) => {
  const [h, adminsResp, rolesResp, xpCfg, tx] = await Promise.all([
    apiGet("/api/health"),
    apiGet("/api/admins"),
    apiGet("/api/shop/roles"),
    apiGet("/api/xp/config"),
    apiGet("/api/logs/transactions?limit=12"),
  ]);

  const adminsCount = Array.isArray(adminsResp.admins) ? adminsResp.admins.length : 0;

  const rolesObj = rolesResp?.roles;
  const rolesArr = Array.isArray(rolesObj)
    ? rolesObj
    : rolesObj && typeof rolesObj === "object"
      ? Object.entries(rolesObj).map(([role_id, v]) => ({ role_id, ...(v || {}) }))
      : [];
  const rolesCount = rolesArr.length;

  const enabled = xpCfg?.xp_config?.enabled;
  const cooldown = xpCfg?.xp_config?.xp_cooldown ?? "-";
  const multiplier = xpCfg?.xp_config?.level_up_multiplier ?? "-";

  const txList = Array.isArray(tx.transactions) ? tx.transactions : [];
  const amounts = txList
    .map((t) => {
      const n = Number(String(t.amount ?? "").replace(/[^\d.-]/g, ""));
      return Number.isFinite(n) ? n : 0;
    })
    .reverse(); // oldest -> newest for chart

  const body = `
  <div class="grid">
    <div class="card col12">
      <div class="row" style="justify-content:space-between">
        <div>
          <h1>Dashboard</h1>
          <div class="msg">نظرة سريعة على حالة البوت + المتجر + XP + آخر العمليات.</div>
        </div>
        <div class="row">
          <a href="/check"><button class="secondary">Quick Check</button></a>
          <a href="/logs"><button class="secondary">Open Logs</button></a>
        </div>
      </div>
    </div>

    <div class="card col3">
      <div class="kpi">
        <div class="kico">${`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l7 4v6c0 5-3 9-7 10-4-1-7-5-7-10V6l7-4z"/><path d="M9 12l1.5 1.5 3.5-4"/></svg>`}</div>
        <div>
          <div class="kval">${esc(h.bot || "not_ready")}</div>
          <div class="klabel">Bot status</div>
          <div class="ktrend">API: ${esc((h.ok === false ? "down" : "up"))}</div>
        </div>
      </div>
    </div>

    <div class="card col3">
      <div class="kpi">
        <div class="kico">${`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 11c1.7 0 3-1.3 3-3S17.7 5 16 5s-3 1.3-3 3 1.3 3 3 3z"/><path d="M8 11c1.7 0 3-1.3 3-3S9.7 5 8 5 5 6.3 5 8s1.3 3 3 3z"/><path d="M21 19v-1c0-1.7-1.3-3-3-3h-4"/><path d="M3 19v-1c0-1.7 1.3-3 3-3h4"/><path d="M12 19v-1c0-1.7 1.3-3 3-3s3 1.3 3 3v1"/></svg>`}</div>
        <div>
          <div class="kval">${esc(adminsCount)}</div>
          <div class="klabel">Admins</div>
          <div class="ktrend">إدارة الأدمنز من صفحة Admins</div>
        </div>
      </div>
    </div>

    <div class="card col3">
      <div class="kpi">
        <div class="kico">${`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2l1.5 4H20l-2 7H8L6 2z"/><path d="M8 13h10"/><path d="M9 22a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"/><path d="M18 22a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"/></svg>`}</div>
        <div>
          <div class="kval">${esc(rolesCount)}</div>
          <div class="klabel">Shop roles</div>
          <div class="ktrend">آخر تحديث: استخدم Refresh</div>
        </div>
      </div>
    </div>

    <div class="card col3">
      <div class="kpi">
        <div class="kico">${`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l2.4 6.9H22l-5.8 4.2L18.6 20 12 15.9 5.4 20l2.4-6.9L2 8.9h7.6L12 2z"/></svg>`}</div>
        <div>
          <div class="kval">${esc(enabled ? "Enabled" : "Disabled")}</div>
          <div class="klabel">XP system</div>
          <div class="ktrend">cooldown: ${esc(cooldown)}s • mult: ${esc(multiplier)}</div>
        </div>
      </div>
    </div>

    <div class="card col7">
      <h2>Recent Transactions</h2>
      <div class="msg" style="margin-bottom:10px">آخر 12 عملية — مع خط بسيط يوضح تغيّر المبالغ.</div>
      <canvas id="spark" class="miniCanvas" height="62"></canvas>
      <div style="margin-top:12px" class="card">
        <table>
          <tr><th>Type</th><th>User</th><th>Amount</th><th>Time</th></tr>
          ${(txList.slice(0, 6) || []).map(t => `<tr><td>${esc(t.type)}</td><td>${esc(t.user_name)}</td><td>${esc(t.amount)}</td><td>${esc(t.timestamp || "")}</td></tr>`).join("") || `<tr><td colspan="4">No transactions</td></tr>`}
        </table>
      </div>
    </div>

    <div class="card col5">
      <h2>Quick Actions</h2>
      <div class="msg">شغلات تستخدمها كثير — كلها بزر واحد.</div>
      <div class="grid" style="margin-top:12px">
        <div class="card col12">
          <div class="row">
            <a href="/settings"><button class="secondary">Templates / Overrides</button></a>
            <a href="/shop"><button class="secondary">Manage Shop</button></a>
            <a href="/balance"><button class="secondary">Set Balance</button></a>
            <a href="/xp"><button class="secondary">XP Config</button></a>
          </div>
        </div>
        <div class="card col12">
          <div class="row" style="justify-content:space-between">
            <div>
              <div class="pill">API Base: ${esc(API_BASE)}</div>
              <div class="pill">Dashboard: ${esc(process.env.PORT || 3000)}</div>
            </div>
            <div>
              <form method="post" action="/shop/refresh" style="margin:0">
                <button>Refresh Shop Message</button>
              </form>
            </div>
          </div>
        </div>
        <div class="card col12">
          <div class="msg rtl">إذا الـ chart طلع فاضي، هذا يعني ما فيه عمليات لسه أو الـ API ما رجّع بيانات.</div>
        </div>
      </div>
    </div>
  </div>

  <script>
    (function(){
      var data = ${JSON.stringify(amounts)};
      var c = document.getElementById('spark');
      if(!c || !c.getContext) return;
      var ctx = c.getContext('2d');
      var w = c.width = c.clientWidth || 400;
      var h = c.height = 62;
      ctx.clearRect(0,0,w,h);

      // background
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(0,0,w,h);
      ctx.globalAlpha = 1;

      if(!data || data.length < 2){
        ctx.fillStyle = 'rgba(248,250,252,0.65)';
        ctx.font = '12px ui-sans-serif, system-ui';
        ctx.fillText('No chart data', 10, 20);
        return;
      }

      var min = Math.min.apply(null, data);
      var max = Math.max.apply(null, data);
      if(min === max){ min = min - 1; max = max + 1; }

      var pad = 8;
      function x(i){ return pad + (w - pad*2) * (i/(data.length-1)); }
      function y(v){ return pad + (h - pad*2) * (1 - ((v - min) / (max - min))); }

      // line
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(248,250,252,0.95)';
      ctx.beginPath();
      for(var i=0;i<data.length;i++){
        var px = x(i), py = y(data[i]);
        if(i===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
      }
      ctx.stroke();

      // dots
      ctx.fillStyle = 'rgba(248,250,252,0.95)';
      for(var i=0;i<data.length;i++){
        var px = x(i), py = y(data[i]);
        ctx.beginPath(); ctx.arc(px,py,2.6,0,Math.PI*2); ctx.fill();
      }
    })();
  </script>
  `;
  res.send(layout(req, "Dashboard", body));
});


// Settings: templates + overrides
app.get("/settings", requireLogin, requireAdmin, async (req, res) => {
  const tpl = await apiGet("/api/templates");
  const ov = await apiGet("/api/overrides");
  const tplEntries = Object.entries(tpl.templates || {}).slice(0, 200);
  const ovEntries = Object.entries(ov.overrides || {}).slice(0, 200);

  const body = `
  <div class="card">
    <div class="pageHead">
      <div class="pageTitle">
        <h1>Settings</h1>
        <p>تحكم برسائل البوت: Templates + Overrides (استبدال نصوص).</p>
      </div>
      <div class="actions">
        <span class="chip">${icons.settings}<span>Templates</span></span>
      </div>
    </div>

    <div class="grid" style="grid-template-columns: 1fr 1fr; gap:14px">
      <div class="card">
        <h2 style="margin-top:0">Update Template</h2>
        <p class="hint">يدعم متغيرات مثل <span class="mono">{amount}</span> <span class="mono">{tax}</span> ...</p>
        <form method="post" action="/settings/template">
          <div class="formGrid">
            <div class="field span2"><label>Template Key</label>
              <input name="key" placeholder="text_transfer_done" required />
            </div>
            <div class="field"><label>Value</label>
              <input name="value" placeholder="✅ تم تحويل {amount} YKZ - الضريبة {tax}" required />
            </div>
          </div>
          <div class="formActions">
            <button>Save</button>
            <button class="secondary" type="reset">Clear</button>
          </div>
        </form>
      </div>

      <div class="card">
        <h2 style="margin-top:0">Text Override (Replace)</h2>
        <p class="hint">إذا خليت الجديد فاضي = إزالة الاستبدال.</p>
        <form method="post" action="/settings/override">
          <div class="formGrid">
            <div class="field"><label>Old Text</label>
              <input name="old" placeholder="Absi" required />
            </div>
            <div class="field"><label>New Text</label>
              <input name="new" placeholder="(empty to remove)" />
            </div>
          </div>
          <div class="formActions">
            <button>Save</button>
            <button class="secondary" type="reset">Clear</button>
          </div>
        </form>
      </div>
    </div>

    <div class="grid" style="grid-template-columns: 1fr 1fr; gap:14px; margin-top:14px">
      <div class="card">
        <div class="tableTools">
          <div>
            <h2 style="margin:0">Templates Preview</h2>
            <div class="hint">عرض أول 200 عنصر (مع فلترة).</div>
          </div>
          <input placeholder="Search..." data-filter="#tplTable" />
        </div>
        <div class="card" style="margin:0">
          <table id="tplTable">
            <thead><tr><th style="width:34%">Key</th><th>Value</th><th style="width:90px">Copy</th></tr></thead>
            <tbody>
              ${tplEntries.map(([k,v]) => `<tr><td class="mono">${esc(k)}</td><td>${esc(v)}</td><td><button type="button" class="btnGhost" data-copy="${esc(k)}">Key</button></td></tr>`).join("") || `<tr><td colspan="3">No templates</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="tableTools">
          <div>
            <h2 style="margin:0">Overrides Preview</h2>
            <div class="hint">عرض أول 200 عنصر (مع فلترة).</div>
          </div>
          <input placeholder="Search..." data-filter="#ovTable" />
        </div>
        <div class="card" style="margin:0">
          <table id="ovTable">
            <thead><tr><th style="width:44%">Old</th><th>New</th></tr></thead>
            <tbody>
              ${ovEntries.map(([k,v]) => `<tr><td class="mono">${esc(k)}</td><td>${esc(v)}</td></tr>`).join("") || `<tr><td colspan="2">No overrides</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>`;
  res.send(layout(req, "Settings", body));
});


app.post("/settings/template", requireLogin, requireAdmin, async (req, res) => {
  const r = await apiPost("/api/templates/set", { key: req.body.key, value: req.body.value });
  return redirectToast(res, "/settings", r, "✅ تم حفظ الـ Template", "❌ فشل حفظ الـ Template");
});


app.post("/settings/override", requireLogin, requireAdmin, async (req, res) => {
  const r = await apiPost("/api/overrides/set", { old: req.body.old, new: req.body.new ?? "" });
  return redirectToast(res, "/settings", r, "✅ تم حفظ الـ Override", "❌ فشل حفظ الـ Override");
});


// Balance
app.get("/balance", requireLogin, requireAdmin, async (req, res) => {
  const body = `
  <div class="card">
    <div class="pageHead">
      <div class="pageTitle">
        <h1>Balance</h1>
        <p>تعديل/إضافة رصيد لأي عضو (بالـ User ID) + جلب الرصيد بسرعة.</p>
      </div>
      <div class="actions">
        <span class="chip">${icons.balance}<span>Economy</span></span>
      </div>
    </div>

    <div class="grid" style="grid-template-columns: 1.2fr .8fr; gap:14px">
      <div class="card">
        <h2 style="margin-top:0">Update Balance</h2>
        <p class="hint">API بتستخدم <span class="mono">amount</span> و <span class="mono">mode</span> (set/add).</p>
        <form method="post" action="/balance/set" data-confirm="تأكيد تعديل الرصيد؟">
          <div class="formGrid">
            <div class="field"><label>User ID</label><input name="user_id" placeholder="123456789012345678" required /></div>
            <div class="field"><label>Mode</label>
              <select name="mode">
                <option value="set">set (استبدال الرصيد)</option>
                <option value="add">add (إضافة على الرصيد)</option>
              </select>
            </div>
            <div class="field"><label>Amount</label><input name="amount" type="number" placeholder="1000" required /></div>
          </div>
          <div class="formActions">
            <button>Apply</button>
            <button class="secondary" type="reset">Clear</button>
          </div>
        </form>
      </div>

      <div class="card">
        <h2 style="margin-top:0">Quick Get</h2>
        <form method="get" action="/balance/get">
          <label>User ID</label>
          <input name="user_id" placeholder="123456789012345678" />
          <div style="margin-top:10px"><button class="secondary">Fetch</button></div>
        </form>
        <div class="hint" style="margin-top:10px">رح يعرض نتيجة الـ API مباشرة.</div>
      </div>
    </div>
  </div>`;
  res.send(layout(req, "Balance", body));
});


app.get("/balance/get", requireLogin, requireAdmin, async (req, res) => {
  const userId = req.query.user_id || "";
  const data = userId ? await apiGet(`/api/balance/get?user_id=${encodeURIComponent(userId)}`) : null;
  const body = `
  <div class="card">
    <h1>Balance Result</h1>
    <div class="msg">${data ? esc(JSON.stringify(data, null, 2)) : "No user_id provided"}</div>
    <a href="/balance"><button class="secondary">Back</button></a>
  </div>`;
  res.send(layout(req, "Balance Result", body));
});

app.post("/balance/set", requireLogin, requireAdmin, async (req, res) => {
  const payload = {
    user_id: String(req.body.user_id || "").trim(),
    mode: String(req.body.mode || "set").toLowerCase(),
    amount: Number(req.body.amount || 0),
  };
  const r = await apiPost("/api/balance/set", payload);
  return redirectToast(res, "/balance", r, "✅ تم تحديث الرصيد بنجاح", "❌ فشل تحديث الرصيد");
});


// Shop
app.get("/shop", requireLogin, requireAdmin, async (req, res) => {
  const roles = await apiGet("/api/shop/roles");
  const roleArr = Array.isArray(roles)
    ? roles
    : (roles && Array.isArray(roles.roles))
      ? roles.roles
      : (roles && roles.roles && typeof roles.roles === "object")
        ? Object.entries(roles.roles).map(([role_id, v]) => ({ role_id, ...v }))
        : [];

  const list = roleArr.map(r => `
    <tr>
      <td class="mono">${esc(r.role_id)}</td>
      <td>${esc(r.name || "")}</td>
      <td class="mono">${esc(r.price ?? "")}</td>
      <td>${esc(r.duration_text || "")}</td>
      <td>${esc(r.emoji || "")}</td>
      <td>
        <form method="post" action="/shop/remove" style="margin:0" data-confirm="حذف الرتبة من المتجر؟">
          <input type="hidden" name="role_id" value="${esc(r.role_id)}" />
          <button class="danger">Remove</button>
        </form>
      </td>
    </tr>`).join("");

  const body = `
  <div class="card">
    <div class="pageHead">
      <div class="pageTitle">
        <h1>Shop</h1>
        <p>إدارة رتب المتجر + تحديث رسالة المتجر.</p>
      </div>
      <div class="actions">
        <form method="post" action="/shop/refresh" style="margin:0">
          <button class="secondary">↻ Refresh Shop Message</button>
        </form>
      </div>
    </div>

    <div class="card">
      <div class="tableTools">
        <div>
          <h2 style="margin:0">Roles</h2>
          <div class="hint">فلترة + إزالة مباشرة.</div>
        </div>
        <input placeholder="Search roles..." data-filter="#rolesTable" />
      </div>
      <div class="card" style="margin:0">
        <table id="rolesTable">
          <thead><tr><th>Role ID</th><th>Name</th><th>Price</th><th>Duration</th><th>Emoji</th><th>Action</th></tr></thead>
          <tbody>
            ${list || "<tr><td colspan='6'>No roles</td></tr>"}
          </tbody>
        </table>
      </div>
    </div>

    <div class="grid" style="grid-template-columns: 1fr 1fr; gap:14px; margin-top:14px">
      <div class="card">
        <h2 style="margin-top:0">Add Role</h2>
        <form method="post" action="/shop/add" data-confirm="إضافة الرتبة للمتجر؟">
          <div class="formGrid">
            <div class="field"><label>Role ID</label><input name="role_id" placeholder="123..." required /></div>
            <div class="field"><label>Name</label><input name="name" placeholder="VIP" required /></div>
            <div class="field"><label>Price</label><input name="price" type="number" placeholder="1000" required /></div>
            <div class="field"><label>Duration (minutes)</label><input name="duration_minutes" type="number" placeholder="0 = دائم" /></div>
            <div class="field"><label>Duration text</label><input name="duration_text" placeholder="دائمة / 30 دقيقة" /></div>
            <div class="field"><label>Emoji</label><input name="emoji" placeholder="⭐" /></div>
          </div>
          <div style="margin-top:10px"><button>Add</button></div>
        </form>
      </div>

      <div class="card">
        <h2 style="margin-top:0">Edit Role</h2>
        <p class="hint">بس عبّي الحقول اللي بدك تغيّرها.</p>
        <form method="post" action="/shop/set">
          <div class="formGrid">
            <div class="field"><label>Role ID</label><input name="role_id" placeholder="123..." required /></div>
            <div class="field"><label>Price</label><input name="price" type="number" placeholder="(optional)" /></div>
            <div class="field"><label>Duration (minutes)</label><input name="duration_minutes" type="number" placeholder="(optional)" /></div>
            <div class="field"><label>Duration text</label><input name="duration_text" placeholder="(optional)" /></div>
            <div class="field"><label>Emoji</label><input name="emoji" placeholder="(optional)" /></div>
          </div>
          <div style="margin-top:10px"><button>Save</button></div>
        </form>
        <div class="hint" style="margin-top:10px">Tip: اضغط Copy لأي Role ID من الجدول فوق.</div>
      </div>
    </div>
  </div>`;
  res.send(layout(req, "Shop", body));
});


app.post("/shop/refresh", requireLogin, requireAdmin, async (req, res) => {
  const r = await apiPost("/api/shop/refresh", {});
  return redirectToast(res, "/shop", r, "✅ تم تحديث رسالة المتجر", "❌ فشل تحديث رسالة المتجر");
});


app.post("/shop/add", requireLogin, requireAdmin, async (req, res) => {
  const r = await apiPost("/api/shop/roles/add", {
    role_id: req.body.role_id,
    name: req.body.name,
    price: Number(req.body.price || 0),
    duration_minutes: Number(req.body.duration_minutes || 0),
    duration_text: req.body.duration_text,
    emoji: req.body.emoji,
  });
  return redirectToast(res, "/shop", r, "✅ تم إضافة الرتبة للمتجر", "❌ فشل إضافة الرتبة");
});


app.post("/shop/set", requireLogin, requireAdmin, async (req, res) => {
  const payload = { role_id: req.body.role_id };
  ["price", "duration_minutes"].forEach((k) => {
    if (req.body[k] !== undefined && req.body[k] !== "") payload[k] = Number(req.body[k]);
  });
  ["duration_text", "emoji"].forEach((k) => {
    if (req.body[k] !== undefined && req.body[k] !== "") payload[k] = req.body[k];
  });
  const r = await apiPost("/api/shop/roles/set", payload);
  return redirectToast(res, "/shop", r, "✅ تم حفظ التعديلات", "❌ فشل حفظ التعديلات");
});


app.post("/shop/remove", requireLogin, requireAdmin, async (req, res) => {
  const r = await apiPost("/api/shop/roles/remove", { role_id: req.body.role_id });
  return redirectToast(res, "/shop", r, "✅ تم حذف الرتبة من المتجر", "❌ فشل حذف الرتبة");
});


// XP
app.get("/xp", requireLogin, requireAdmin, async (req, res) => {
  const cfg = await apiGet("/api/xp/config");
  const top = await apiGet("/api/xp/top?limit=10");
  const enabled = !!cfg.xp_config?.enabled;

  const body = `
  <div class="card">
    <div class="pageHead">
      <div class="pageTitle">
        <h1>XP</h1>
        <p>إعدادات نظام الخبرة + Top 10 + بحث عن لاعب.</p>
      </div>
      <div class="actions">
        <span class="chip">${icons.xp}<span>${enabled ? "Enabled" : "Disabled"}</span></span>
      </div>
    </div>

    <div class="grid" style="grid-template-columns: 1fr .9fr; gap:14px">
      <div class="card">
        <h2 style="margin-top:0">Config</h2>
        <form method="post" action="/xp/config">
          <div class="formGrid">
            <div class="field"><label>xp_cooldown (seconds)</label><input name="xp_cooldown" type="number" value="${esc(cfg.xp_config?.xp_cooldown ?? 60)}" /></div>
            <div class="field"><label>level_up_multiplier</label><input name="level_up_multiplier" type="number" value="${esc(cfg.xp_config?.level_up_multiplier ?? 100)}" /></div>
            <div class="field"><label>enabled</label>
              <select name="enabled">
                <option value="true" ${enabled ? "selected" : ""}>true</option>
                <option value="false" ${!enabled ? "selected" : ""}>false</option>
              </select>
            </div>
          </div>
          <div style="margin-top:10px"><button>Save Config</button></div>
        </form>
      </div>

      <div class="card">
        <h2 style="margin-top:0">User Lookup</h2>
        <form method="get" action="/xp/user">
          <label>User ID</label>
          <input name="user_id" placeholder="123456789012345678" />
          <div style="margin-top:10px"><button class="secondary">Fetch</button></div>
        </form>
        <div class="hint" style="margin-top:10px">يعرض (level / xp / total) حسب API.</div>
      </div>
    </div>

    <div class="card" style="margin-top:14px">
      <div class="tableTools">
        <div>
          <h2 style="margin:0">Top XP</h2>
          <div class="hint">أفضل 10 حالياً.</div>
        </div>
        <input placeholder="Search in top..." data-filter="#topXp" />
      </div>
      <div class="card" style="margin:0">
        <table id="topXp">
          <thead><tr><th>#</th><th>User</th><th>Level</th><th>XP</th><th>Total</th></tr></thead>
          <tbody>
            ${(top.top || []).map(u => `<tr><td class="mono">${esc(u.rank)}</td><td>${esc(u.user_name || u.user_id || "")}</td><td class="mono">${esc(u.level)}</td><td class="mono">${esc(u.xp)}</td><td class="mono">${esc(u.total_xp)}</td></tr>`).join("") || `<tr><td colspan="5">No data</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  </div>`;
  res.send(layout(req, "XP", body));
});


app.post("/xp/config", requireLogin, requireAdmin, async (req, res) => {
  const r = await apiPost("/api/xp/config/set", {
    xp_cooldown: Number(req.body.xp_cooldown),
    level_up_multiplier: Number(req.body.level_up_multiplier),
    enabled: String(req.body.enabled) === "true",
  });
  return redirectToast(res, "/xp", r, "✅ تم حفظ إعدادات XP", "❌ فشل حفظ إعدادات XP");
});


app.get("/xp/user", requireLogin, requireAdmin, async (req, res) => {
  const userId = req.query.user_id || "";
  const data = userId ? await apiGet(`/api/xp/user?user_id=${encodeURIComponent(userId)}`) : null;
  const body = `
  <div class="card">
    <h1>User XP</h1>
    <div class="msg">${data ? esc(JSON.stringify(data, null, 2)) : "No user_id provided"}</div>
    <a href="/xp"><button class="secondary">Back</button></a>
  </div>`;
  res.send(layout(req, "User XP", body));
});

// Logs
app.get("/logs", requireLogin, requireAdmin, async (req, res) => {
  const tx = await apiGet("/api/logs/transactions?limit=50");
  const sys = await apiGet("/api/logs/system?limit=50");

  const body = `
  <div class="card">
    <div class="pageHead">
      <div class="pageTitle">
        <h1>Logs</h1>
        <p>آخر العمليات + لوجات النظام (50 آخر عنصر) مع فلترة.</p>
      </div>
      <div class="actions">
        <span class="chip">${icons.logs}<span>Audit</span></span>
      </div>
    </div>

    <div class="grid" style="grid-template-columns: 1fr 1fr; gap:14px">
      <div class="card">
        <div class="tableTools">
          <div>
            <h2 style="margin:0">Transactions</h2>
            <div class="hint">آخر 50 عملية.</div>
          </div>
          <input placeholder="Search..." data-filter="#txTable" />
        </div>
        <div class="card" style="margin:0">
          <table id="txTable">
            <thead><tr><th>Type</th><th>User</th><th>Amount</th><th>Details</th><th>Time</th></tr></thead>
            <tbody>
              ${(tx.transactions || []).map(t => `<tr><td>${esc(t.type)}</td><td>${esc(t.user_name)}</td><td class="mono">${esc(t.amount)}</td><td>${esc(t.details || "")}</td><td class="mono">${esc(t.timestamp || "")}</td></tr>`).join("") || `<tr><td colspan="5">No transactions</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="tableTools">
          <div>
            <h2 style="margin:0">System Logs</h2>
            <div class="hint">آخر 50 حدث.</div>
          </div>
          <input placeholder="Search..." data-filter="#sysTable" />
        </div>
        <div class="card" style="margin:0">
          <table id="sysTable">
            <thead><tr><th>Action</th><th>User</th><th>Details</th><th>Time</th></tr></thead>
            <tbody>
              ${(sys.logs || []).map(l => `<tr><td>${esc(l.action)}</td><td>${esc(l.user_name)}</td><td>${esc(l.details || "")}</td><td class="mono">${esc(l.timestamp || "")}</td></tr>`).join("") || `<tr><td colspan="4">No logs</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>`;
  res.send(layout(req, "Logs", body));
});



// Admins management
app.get("/admins", requireLogin, requireAdmin, async (req, res) => {
  const data = await apiGet("/api/admins");
  const admins = data.admins || [];
  const ownerId = OWNER_ID || "1219956413586214942";

  const body = `
  <div class="card">
    <div class="pageHead">
      <div class="pageTitle">
        <h1>Admins</h1>
        <p>إدارة الأدمنز (User IDs). المالك دائماً أدمن.</p>
      </div>
      <div class="actions">
        <span class="chip">${icons.admins}<span>${esc(admins.length)} admins</span></span>
      </div>
    </div>

    <div class="grid" style="grid-template-columns: .95fr 1.05fr; gap:14px">
      <div class="card">
        <h2 style="margin-top:0">Add Admin</h2>
        <form method="post" action="/admins/add" data-confirm="إضافة أدمن جديد؟">
          <label>User ID</label>
          <input name="user_id" placeholder="1219956413586214942" required />
          <div style="margin-top:10px"><button>Add</button></div>
        </form>
        <div class="hint" style="margin-top:10px">Tip: تقدر تنسخ ID بضغطة من الجدول.</div>
      </div>

      <div class="card">
        <div class="tableTools">
          <div>
            <h2 style="margin:0">Current Admins</h2>
            <div class="hint">اضغط Copy لنسخ الـ ID.</div>
          </div>
          <input placeholder="Search..." data-filter="#adminsTable" />
        </div>
        <div class="card" style="margin:0">
          <table id="adminsTable">
            <thead><tr><th>User ID</th><th style="width:140px">Tools</th><th style="width:120px">Action</th></tr></thead>
            <tbody>
              ${admins.map(id => `
                <tr>
                  <td class="mono">${esc(id)}</td>
                  <td>
                    <button type="button" class="btnGhost" data-copy="${esc(id)}">Copy</button>
                  </td>
                  <td>
                    <form method="post" action="/admins/remove" style="margin:0" data-confirm="حذف هذا الأدمن؟">
                      <input type="hidden" name="user_id" value="${esc(id)}" />
                      <button class="danger" ${String(id)===String(ownerId) ? "disabled" : ""}>Remove</button>
                    </form>
                  </td>
                </tr>`).join("") || `<tr><td colspan="3">No admins</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>`;
  res.send(layout(req, "Admins", body));
});


app.post("/admins/add", requireLogin, requireAdmin, async (req, res) => {
  const user_id = String(req.body.user_id || "").trim();
  const r = await apiPost("/api/admins/add", { user_id });
  return redirectToast(res, "/admins", r, "✅ تم إضافة الأدمن", "❌ فشل إضافة الأدمن");
});


app.post("/admins/remove", requireLogin, requireAdmin, async (req, res) => {
  const user_id = String(req.body.user_id || "").trim();
  const r = await apiPost("/api/admins/remove", { user_id });
  return redirectToast(res, "/admins", r, "✅ تم حذف الأدمن", "❌ فشل حذف الأدمن");
});


app.listen(PORT, () => console.log(`Dashboard running on http://localhost:${PORT}`));
