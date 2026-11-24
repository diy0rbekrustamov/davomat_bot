"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.escapeHtml = void 0;
exports.runtimeDiagnostics = runtimeDiagnostics;
const os_1 = __importDefault(require("os"));
const fs_1 = __importDefault(require("fs"));
const tls_1 = __importDefault(require("tls"));
const perf_hooks_1 = require("perf_hooks");
const escapeHtml = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
exports.escapeHtml = escapeHtml;
const gb = (bytes) => (bytes / 1024 ** 3).toFixed(2) + ' GB';
const duration = (seconds) => { const m = Math.floor(seconds / 60); return `${Math.floor(m / 1440)} kun ${Math.floor(m % 1440 / 60)} soat ${m % 60} daqiqa`; };
function cpuTimes() { const values = fs_1.default.readFileSync('/proc/stat', 'utf8').split('\n')[0].trim().split(/\s+/).slice(1).map(Number); return { total: values.slice(0, 8).reduce((a, b) => a + b, 0), idle: values[3] + values[4] }; }
async function cpuUsage() { try {
    const before = cpuTimes();
    await new Promise(r => setTimeout(r, 250));
    const after = cpuTimes(), total = after.total - before.total;
    return total > 0 ? (100 * (1 - (after.idle - before.idle) / total)).toFixed(1) + '%' : 'o‘lchash uchun vaqt yetarli emas';
}
catch {
    return 'o‘lchab bo‘lmadi';
} }
async function probe(url) { const start = perf_hooks_1.performance.now(); try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    await response.body?.cancel();
    return { ok: response.ok, ms: (perf_hooks_1.performance.now() - start).toFixed(1), status: response.status };
}
catch {
    return { ok: false, ms: (perf_hooks_1.performance.now() - start).toFixed(1), status: 0 };
} }
function sslProbe() {
    return new Promise(resolve => {
        let done = false;
        const finish = (value) => { if (done)
            return; done = true; socket.destroy(); resolve(value); };
        const socket = tls_1.default.connect({ host: 'davomat.provveb.uz', port: 443, servername: 'davomat.provveb.uz', rejectUnauthorized: true }, () => { const cert = socket.getPeerCertificate(); const days = Math.floor((Date.parse(cert.valid_to) - Date.now()) / 86400000); finish({ ok: socket.authorized && days >= 0, days }); });
        socket.setTimeout(5000, () => finish({ ok: false }));
        socket.on('error', () => finish({ ok: false }));
    });
}
async function runtimeDiagnostics() {
    const [load, api, web, ssl] = await Promise.all([cpuUsage(), probe('http://127.0.0.1:3000/health'), probe('https://davomat.provveb.uz/'), sslProbe()]);
    const issues = [];
    if (!api.ok)
        issues.push('API javob bermadi');
    if (!web.ok)
        issues.push('domen javob bermadi');
    if (!ssl.ok)
        issues.push('SSL tasdiqlanmadi');
    else if ((ssl.days ?? 0) < 7)
        issues.push('SSL muddati 7 kundan kam');
    let ram = 'o‘lchab bo‘lmadi', disk = 'o‘lchab bo‘lmadi';
    try {
        const mem = fs_1.default.readFileSync('/proc/meminfo', 'utf8'), total = Number(mem.match(/^MemTotal:\s+(\d+)/m)?.[1]) * 1024, available = Number(mem.match(/^MemAvailable:\s+(\d+)/m)?.[1]) * 1024;
        if (!total || !available)
            throw Error();
        ram = `${gb(total - available)} / ${gb(total)} (${(100 * (total - available) / total).toFixed(1)}%)`;
        if (available / total < .05)
            issues.push('server RAM bo‘sh joyi 5% dan kam');
    }
    catch {
        issues.push('RAM o‘lchanmadi');
    }
    try {
        const s = fs_1.default.statfsSync('/app'), total = s.blocks * s.bsize, used = (s.blocks - s.bfree) * s.bsize;
        disk = `${gb(used)} / ${gb(total)}; bo‘sh: ${gb(s.bavail * s.bsize)}`;
        if (s.bavail / s.blocks < .05)
            issues.push('disk bo‘sh joyi 5% dan kam');
    }
    catch {
        issues.push('disk o‘lchanmadi');
    }
    if (load === 'o‘lchab bo‘lmadi')
        issues.push('CPU o‘lchanmadi');
    const memory = process.memoryUsage();
    const cpu = os_1.default.cpus();
    return { issues, api, web, ssl, os: process.env.SERVER_OS || `Linux ${os_1.default.release()}`, cpu: cpu.length ? `${cpu[0].model.trim()} — ${cpu.length} vCPU` : 'noma’lum', load, loadavg: os_1.default.loadavg().map(v => v.toFixed(2)).join(' / '), ram, disk, uptime: duration(os_1.default.uptime()), nodeUptime: duration(process.uptime()), heap: `${(memory.heapUsed / 1024 ** 2).toFixed(1)} / ${(memory.heapTotal / 1024 ** 2).toFixed(1)} MB`, rss: `${(memory.rss / 1024 ** 2).toFixed(1)} MB` };
}
