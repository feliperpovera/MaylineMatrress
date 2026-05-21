<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(405, ['success' => false, 'error' => 'Metodo no permitido']);
}

define('ADMIN_USER', getenv('MAYLIN_ADMIN_USER') ?: 'admin_maylin');
define('ADMIN_PASS', getenv('MAYLIN_ADMIN_PASS') ?: 'MaylinSecurePassword2026!');
define('SESSION_TTL_SECONDS', 86400);

$private_dir = __DIR__ . '/private';
$submissions_file = $private_dir . '/submissions.json';
$sessions_file = $private_dir . '/sessions.json';

function respond(int $status, array $payload): void {
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

function ensure_private_dir(string $private_dir): void {
    if (!is_dir($private_dir)) {
        mkdir($private_dir, 0755, true);
    }
}

function read_json_file(string $file, array $fallback): array {
    if (!file_exists($file)) {
        return $fallback;
    }

    $content = file_get_contents($file);
    if ($content === false || trim($content) === '') {
        return $fallback;
    }

    $decoded = json_decode($content, true);
    return is_array($decoded) ? $decoded : $fallback;
}

function write_json_file(string $file, array $data): bool {
    $tmp = $file . '.' . getmypid() . '.tmp';
    $encoded = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

    if ($encoded === false || file_put_contents($tmp, $encoded, LOCK_EX) === false) {
        return false;
    }

    return rename($tmp, $file);
}

function locked_update(string $file, callable $updater): array {
    $lock_file = $file . '.lock';
    $lock = fopen($lock_file, 'c');

    if ($lock === false || !flock($lock, LOCK_EX)) {
        return ['ok' => false, 'error' => 'No se pudo bloquear el archivo'];
    }

    $current = read_json_file($file, []);
    $result = $updater($current);

    if (($result['write'] ?? true) === true && !write_json_file($file, $result['data'] ?? $current)) {
        flock($lock, LOCK_UN);
        fclose($lock);
        return ['ok' => false, 'error' => 'No se pudo guardar la informacion'];
    }

    flock($lock, LOCK_UN);
    fclose($lock);
    return ['ok' => true, 'result' => $result];
}

function input_payload(): array {
    $raw_input = file_get_contents('php://input');
    $json = json_decode($raw_input ?: '', true);
    return is_array($json) ? $json : $_POST;
}

function clean_text($value, int $max_length): string {
    $text = trim((string)($value ?? ''));
    if (function_exists('mb_substr')) {
        return mb_substr($text, 0, $max_length);
    }
    return substr($text, 0, $max_length);
}

function validate_submission(array $data): array {
    $submission = [
        'nombre' => clean_text($data['nombre'] ?? '', 120),
        'correo' => strtolower(clean_text($data['correo'] ?? '', 180)),
        'celular' => clean_text($data['celular'] ?? '', 60),
        'mensaje' => clean_text($data['mensaje'] ?? '', 2000),
    ];

    if ($submission['nombre'] === '' || $submission['correo'] === '' || $submission['celular'] === '' || $submission['mensaje'] === '') {
        return ['error' => 'Todos los campos son obligatorios'];
    }

    if (!filter_var($submission['correo'], FILTER_VALIDATE_EMAIL)) {
        return ['error' => 'Ingresa un correo valido'];
    }

    if (!preg_match('/^[0-9+().\-\s]{7,}$/', $submission['celular'])) {
        return ['error' => 'Ingresa un celular valido'];
    }

    return ['submission' => $submission];
}

function get_bearer_token(): string {
    $headers = function_exists('getallheaders') ? getallheaders() : [];
    $authorization = $headers['Authorization'] ?? $headers['authorization'] ?? ($_SERVER['HTTP_AUTHORIZATION'] ?? '');

    if (preg_match('/Bearer\s+(\S+)/', $authorization, $matches)) {
        return $matches[1];
    }

    return '';
}

function clean_sessions(array $sessions): array {
    $now = time();
    return array_filter($sessions, function ($created_at) use ($now) {
        return is_numeric($created_at) && ($now - (int)$created_at) < SESSION_TTL_SECONDS;
    });
}

function is_authorized(string $token, string $sessions_file): bool {
    if ($token === '') {
        return false;
    }

    $sessions = clean_sessions(read_json_file($sessions_file, []));
    return isset($sessions[$token]);
}

$data = input_payload();
$action = $data['action'] ?? '';

if ($action === '' && isset($data['nombre'], $data['correo'])) {
    $action = 'submit';
}

ensure_private_dir($private_dir);

if ($action === 'submit') {
    $validated = validate_submission($data);
    if (isset($validated['error'])) {
        respond(400, ['success' => false, 'error' => $validated['error']]);
    }

    $submission = [
        'id' => 'sub_' . time() . '_' . bin2hex(random_bytes(6)),
        'createdAt' => date('c'),
    ] + $validated['submission'];

    $updated = locked_update($submissions_file, function (array $submissions) use ($submission) {
        array_unshift($submissions, $submission);
        return ['data' => array_values($submissions)];
    });

    if (!$updated['ok']) {
        respond(500, ['success' => false, 'error' => 'Error interno del servidor al guardar']);
    }

    respond(200, ['success' => true]);
}

if ($action === 'login') {
    $username = clean_text($data['username'] ?? '', 120);
    $password = (string)($data['password'] ?? '');

    if ($username !== ADMIN_USER || $password !== ADMIN_PASS) {
        respond(401, ['success' => false, 'error' => 'Usuario o contraseña incorrectos']);
    }

    $token = 'tok_' . bin2hex(random_bytes(32));
    $updated = locked_update($sessions_file, function (array $sessions) use ($token) {
        $sessions = clean_sessions($sessions);
        $sessions[$token] = time();
        return ['data' => $sessions];
    });

    if (!$updated['ok']) {
        respond(500, ['success' => false, 'error' => 'No se pudo crear la sesion']);
    }

    respond(200, ['success' => true, 'token' => $token]);
}

$token = clean_text($data['token'] ?? '', 160);
if ($token === '') {
    $token = get_bearer_token();
}

if (!is_authorized($token, $sessions_file)) {
    respond(401, ['success' => false, 'error' => 'No autorizado']);
}

if ($action === 'submissions') {
    $submissions = read_json_file($submissions_file, []);
    respond(200, ['success' => true, 'submissions' => array_values($submissions)]);
}

if ($action === 'delete') {
    respond(403, ['success' => false, 'error' => 'Messages are permanent and cannot be deleted.']);
}

respond(400, ['success' => false, 'error' => 'Accion no valida']);
