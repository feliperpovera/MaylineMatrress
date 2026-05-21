const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const app = express();
const rootDir = __dirname;
const port = process.env.PORT || 3000;

app.disable("x-powered-by");
app.set("trust proxy", true);

const ADMIN_USER = process.env.MAYLIN_ADMIN_USER || "admin_maylin";
const ADMIN_PASS = process.env.MAYLIN_ADMIN_PASS || "MaylinSecurePassword2026!";
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const SUBMISSIONS_FILE = path.join(rootDir, "private", "submissions.json");
const activeSessions = new Map();
const rateBuckets = new Map();

app.use(express.json({ limit: "24kb" }));
app.use(express.urlencoded({ extended: true }));

app.use((request, response, next) => {
  if (request.path.startsWith("/private")) {
    return response.status(404).send("Not found");
  }

  if (request.path.endsWith(".php")) {
    return response.status(404).send("Not found");
  }

  return next();
});

app.use(express.static(rootDir, { dotfiles: "ignore", extensions: ["html"], index: false }));

app.get("/", (_request, response) => {
  response.sendFile(path.join(rootDir, "index.html"));
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

const getClientId = (request) => request.ip || request.headers["x-forwarded-for"] || "unknown";

const isRateLimited = (key, limit, windowMs) => {
  const now = Date.now();
  const recentHits = (rateBuckets.get(key) || []).filter((hit) => now - hit < windowMs);
  recentHits.push(now);
  rateBuckets.set(key, recentHits);
  return recentHits.length > limit;
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

app.post("/api/contact", (req, res) => {
  const clientId = getClientId(req);
  if (isRateLimited(`contact:${clientId}`, 8, 10 * 60 * 1000)) {
    return jsonResponse(res, 429, { success: false, error: "Demasiados intentos. Intenta más tarde." });
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

  const submissions = getSubmissions();
  submissions.unshift(newSubmission);

  if (saveSubmissions(submissions)) {
    return jsonResponse(res, 200, { success: true });
  }

  return jsonResponse(res, 500, { success: false, error: "Error interno del servidor al guardar" });
});

app.post("/api/admin/login", (req, res) => {
  const { username, password } = req.body;
  const clientId = getClientId(req);

  if (isRateLimited(`login:${clientId}`, 10, 15 * 60 * 1000)) {
    return jsonResponse(res, 429, { success: false, error: "Demasiados intentos. Intenta más tarde." });
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
  return jsonResponse(res, 200, { success: true, submissions: getSubmissions() });
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
