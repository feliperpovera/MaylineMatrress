const express = require("express");
const path = require("path");
const fs = require("fs");
const os = require("os");
const crypto = require("crypto");

const app = express();
const rootDir = __dirname;
const port = process.env.PORT || 3000;

app.disable("x-powered-by");
app.set("trust proxy", true);

// This default is deliberate and the owner's call: the panel only lists
// contact form messages, and keeping it working without setup was preferred
// over rotating the credential. Note the value is visible in the public GitHub
// repo. Set MAYLIN_ADMIN_PASS to override it without a code change.
const ADMIN_USER = process.env.MAYLIN_ADMIN_USER || "admin_maylin";
const ADMIN_PASS = process.env.MAYLIN_ADMIN_PASS || "MaylinSecurePassword2026!";

// Lead notifications. RESEND_API_KEY is the only secret needed; without it the
// app still accepts submissions, it just cannot email them.
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const LEAD_TO = process.env.MAYLIN_LEAD_TO || "maylinmattress@gmail.com";
const LEAD_FROM = process.env.MAYLIN_LEAD_FROM || "onboarding@resend.dev";
const EMAIL_TIMEOUT_MS = 8000;

if (!RESEND_API_KEY) {
  console.warn(
    "RESEND_API_KEY is not set -- contact form submissions will NOT be emailed. " +
      "Because the container is ephemeral, that means they are not durably stored anywhere.",
  );
}
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

// Contact submissions must live OUTSIDE rootDir. Hostinger redeploys replace
// the whole app directory, so anything written inside it (the old
// private/submissions.json) is destroyed on every push. The home directory
// survives deploys. Override with MAYLIN_DATA_DIR if the host ever changes.
const DATA_DIR = process.env.MAYLIN_DATA_DIR || path.join(os.homedir(), "maylin-data");
const SUBMISSIONS_FILE = path.join(DATA_DIR, "submissions.json");
const LEGACY_SUBMISSIONS_FILE = path.join(rootDir, "private", "submissions.json");

const activeSessions = new Map();
const rateBuckets = new Map();

// One-time carry-over: if a previous deploy still has submissions in the old
// in-app location and the persistent file does not exist yet, keep them.
const migrateLegacySubmissions = () => {
  try {
    if (fs.existsSync(SUBMISSIONS_FILE) || !fs.existsSync(LEGACY_SUBMISSIONS_FILE)) {
      return;
    }
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.copyFileSync(LEGACY_SUBMISSIONS_FILE, SUBMISSIONS_FILE);
    console.log(`Migrated submissions from ${LEGACY_SUBMISSIONS_FILE} to ${SUBMISSIONS_FILE}`);
  } catch (error) {
    console.error("Could not migrate legacy submissions:", error);
  }
};

migrateLegacySubmissions();
console.log(`Contact submissions stored at: ${SUBMISSIONS_FILE}`);

app.use(express.json({ limit: "24kb" }));
app.use(express.urlencoded({ extended: true }));

// express.static below serves rootDir, which is the whole project directory --
// so without this, https://maylinmattress.com/server.js returns the source,
// admin credentials included. Everything the browser legitimately needs is
// listed in PUBLIC_FILES; anything else under the root stays private.
const PUBLIC_FILES = new Set([
  "/index.html",
  "/es.html",
  "/admin.html",
  "/gracias.html",
  "/portal.html",
  "/main.js",
  "/portal.js",
  "/storage.js",
  "/supabase.js",
  "/supabase-config.js",
  "/styles.css",
  "/robots.txt",
  "/sitemap.xml",
]);

const isPublicPath = (requestPath) =>
  PUBLIC_FILES.has(requestPath) || requestPath.startsWith("/assets/");

app.use((request, response, next) => {
  const requestPath = request.path;

  if (requestPath.startsWith("/private")) {
    return response.status(404).send("Not found");
  }

  if (requestPath.endsWith(".php")) {
    return response.status(404).send("Not found");
  }

  // Routes (/, /es, /admin, ...) are handled further down and carry no file
  // extension; only extension-bearing requests reach express.static.
  const looksLikeFile = /\.[a-z0-9]+$/i.test(requestPath);
  if (looksLikeFile && !isPublicPath(requestPath)) {
    return response.status(404).send("Not found");
  }

  return next();
});

app.use(express.static(rootDir, { dotfiles: "ignore", extensions: ["html"], index: false }));

app.get("/", (_request, response) => {
  response.sendFile(path.join(rootDir, "index.html"));
});

app.get("/gracias", (_request, response) => {
  response.sendFile(path.join(rootDir, "gracias.html"));
});

app.get("/admin", (_request, response) => {
  response.sendFile(path.join(rootDir, "admin.html"));
});

app.get("/es", (_request, response) => {
  response.sendFile(path.join(rootDir, "es.html"));
});

app.get("/en", (_request, response) => {
  response.redirect(301, "/");
});

app.get("/portal", (_request, response) => {
  response.sendFile(path.join(rootDir, "portal.html"));
});

const jsonResponse = (response, status, payload) => {
  response.set("Cache-Control", "no-store");
  return response.status(status).json(payload);
};

const pruneSessions = () => {
  const now = Date.now();
  for (const [token, session] of activeSessions.entries()) {
    if (now - session.createdAt > SESSION_TTL_MS) {
      activeSessions.delete(token);
    }
  }
};

// Behind Hostinger's CDN the socket address is the proxy, so prefer the
// forwarded client address. Without this every visitor can share one bucket
// and a single noisy client locks everyone else out.
const getClientId = (request) => {
  const forwarded = request.headers["x-forwarded-for"];
  const clientAddress = typeof forwarded === "string" ? forwarded.split(",")[0].trim() : "";
  return clientAddress || request.ip || "unknown";
};

// Returns { limited, retryAfterSeconds }. A blocked attempt is deliberately NOT
// recorded: counting it would slide the window forward on every retry, so
// someone who keeps hitting the button could never get back in.
const checkRateLimit = (key, limit, windowMs) => {
  const now = Date.now();
  const recentHits = (rateBuckets.get(key) || []).filter((hit) => now - hit < windowMs);

  if (recentHits.length >= limit) {
    rateBuckets.set(key, recentHits);
    const retryAfterMs = windowMs - (now - recentHits[0]);
    return { limited: true, retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
  }

  recentHits.push(now);
  rateBuckets.set(key, recentHits);
  return { limited: false };
};

const normalizeText = (value, maxLength) => String(value ?? "").trim().slice(0, maxLength);

const validateSubmission = (body) => {
  const submission = {
    nombre: normalizeText(body.nombre, 120),
    correo: normalizeText(body.correo, 180).toLowerCase(),
    celular: normalizeText(body.celular, 60),
    mensaje: normalizeText(body.mensaje, 2000),
  };

  if (!submission.nombre || !submission.correo || !submission.celular || !submission.mensaje) {
    return { error: "Todos los campos son obligatorios" };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(submission.correo)) {
    return { error: "Ingresa un correo válido" };
  }

  if (!/^[0-9+().\-\s]{7,}$/.test(submission.celular)) {
    return { error: "Ingresa un celular válido" };
  }

  return { submission };
};

const getSubmissions = () => {
  try {
    if (!fs.existsSync(SUBMISSIONS_FILE)) {
      return [];
    }
    const data = fs.readFileSync(SUBMISSIONS_FILE, "utf8");
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Error reading submissions:", error);
    return [];
  }
};

const saveSubmissions = (submissions) => {
  try {
    const dir = path.dirname(SUBMISSIONS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const tmpFile = `${SUBMISSIONS_FILE}.${process.pid}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(submissions, null, 2), "utf8");
    fs.renameSync(tmpFile, SUBMISSIONS_FILE);
    return true;
  } catch (error) {
    console.error("Error writing submissions:", error);
    return false;
  }
};

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// Resend's REST API uses snake_case reply_to. Their Node SDK uses replyTo, so
// code copied from SDK examples silently drops the header and replies go to
// the From address instead of the customer. Keep this snake_case.
const sendLeadEmail = async (submission) => {
  if (!RESEND_API_KEY) {
    return { sent: false, reason: "RESEND_API_KEY not set" };
  }

  const rows = [
    ["Nombre", submission.nombre],
    ["Correo", submission.correo],
    ["Teléfono", submission.celular],
    ["Mensaje", submission.mensaje],
  ]
    .map(
      ([label, value]) =>
        `<tr><td style="padding:6px 12px;font-weight:bold;vertical-align:top">${label}</td>` +
        `<td style="padding:6px 12px;white-space:pre-wrap">${escapeHtml(value)}</td></tr>`,
    )
    .join("");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), EMAIL_TIMEOUT_MS);

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        from: `Maylin Mattress <${LEAD_FROM}>`,
        to: [LEAD_TO],
        reply_to: submission.correo,
        subject: `Nuevo mensaje de ${submission.nombre}`,
        html:
          `<h2 style="font-family:sans-serif">Nuevo mensaje del sitio web</h2>` +
          `<table style="font-family:sans-serif;font-size:15px;border-collapse:collapse">${rows}</table>` +
          `<p style="font-family:sans-serif;font-size:13px;color:#666">` +
          `Responde a este correo para contestarle directamente al cliente.</p>`,
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error(`Resend rejected the send (${response.status}): ${detail}`);
      return { sent: false, reason: `resend ${response.status}` };
    }

    return { sent: true };
  } catch (error) {
    // Includes the AbortError from the timeout above.
    console.error("Lead email failed:", error);
    return { sent: false, reason: error.name === "AbortError" ? "timeout" : "network" };
  } finally {
    clearTimeout(timeout);
  }
};

app.post("/api/contact", async (req, res) => {
  // Express 4 does not catch rejections from async handlers -- an uncaught one
  // reaches process level and Node 22 exits, taking the whole site down. Every
  // path below this point must stay inside this try/catch.
  try {
    const clientId = getClientId(req);
    const contactLimit = checkRateLimit(`contact:${clientId}`, 8, 10 * 60 * 1000);
    if (contactLimit.limited) {
      return jsonResponse(res, 429, {
        success: false,
        error: "Demasiados intentos. Intenta más tarde.",
        retryAfterSeconds: contactLimit.retryAfterSeconds,
      });
    }

    // Backstop against a spammer burning the mail provider's free tier from
    // many IPs. Generous enough that real traffic will never notice.
    const globalLimit = checkRateLimit("contact:global", 60, 60 * 60 * 1000);
    if (globalLimit.limited) {
      console.warn("Global contact rate limit hit -- possible abuse.");
      return jsonResponse(res, 429, {
        success: false,
        error: "Demasiados intentos. Intenta más tarde.",
        retryAfterSeconds: globalLimit.retryAfterSeconds,
      });
    }

    const { submission, error } = validateSubmission(req.body);
    if (error) {
      return jsonResponse(res, 400, { success: false, error });
    }

    const newSubmission = {
      id: `sub_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`,
      createdAt: new Date().toISOString(),
      ...submission,
    };

    // Keep the read-modify-write synchronous and contiguous. Awaiting between
    // the read and the write would let a concurrent request interleave and
    // drop one of the two submissions. This copy only lives until the next
    // deploy; the email below is the durable record.
    const submissions = getSubmissions();
    submissions.unshift(newSubmission);
    saveSubmissions(submissions);

    const emailResult = await sendLeadEmail(newSubmission);

    if (!emailResult.sent) {
      // The file copy dies on the next deploy, so a failed email means the
      // lead is genuinely lost. Say so rather than showing a success page.
      console.error(`LEAD NOT DELIVERED (${emailResult.reason}):`, JSON.stringify(newSubmission));
      return jsonResponse(res, 502, {
        success: false,
        error: "No pudimos enviar tu mensaje. Por favor llámanos al (786) 306-7842.",
      });
    }

    return jsonResponse(res, 200, { success: true });
  } catch (unexpected) {
    console.error("Unexpected failure in /api/contact:", unexpected);
    return jsonResponse(res, 500, {
      success: false,
      error: "No pudimos enviar tu mensaje. Por favor llámanos al (786) 306-7842.",
    });
  }
});

app.post("/api/admin/login", (req, res) => {
  const { username, password } = req.body;
  const clientId = getClientId(req);

  const loginLimit = checkRateLimit(`login:${clientId}`, 10, 15 * 60 * 1000);
  if (loginLimit.limited) {
    return jsonResponse(res, 429, {
      success: false,
      error: "Demasiados intentos. Intenta más tarde.",
      retryAfterSeconds: loginLimit.retryAfterSeconds,
    });
  }

  if (username === ADMIN_USER && password === ADMIN_PASS) {
    pruneSessions();
    const token = `tok_${crypto.randomBytes(32).toString("hex")}`;
    activeSessions.set(token, { createdAt: Date.now() });
    return jsonResponse(res, 200, { success: true, token });
  }

  return jsonResponse(res, 401, { success: false, error: "Usuario o contraseña incorrectos" });
});

const authenticateToken = (req, res, next) => {
  const token = req.body.token || req.headers["authorization"]?.split(" ")[1];
  pruneSessions();

  if (token && activeSessions.has(token)) {
    next();
  } else {
    jsonResponse(res, 401, { success: false, error: "No autorizado" });
  }
};

app.post("/api/admin/submissions", authenticateToken, (req, res) => {
  return jsonResponse(res, 200, {
    success: true,
    submissions: getSubmissions(),
    // Surfaced so the storage location can be confirmed without shell access.
    storagePath: SUBMISSIONS_FILE,
  });
});

app.post("/api/admin/delete", authenticateToken, (req, res) => {
  return jsonResponse(res, 403, {
    success: false,
    error: "Messages are permanent and cannot be deleted.",
  });
});

app.listen(port, () => {
  console.log(`Maylin Mattress app listening on port ${port}`);
});
