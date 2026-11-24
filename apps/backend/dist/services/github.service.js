"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.githubService = exports.GithubSyncService = void 0;
const rest_1 = require("@octokit/rest");
const path_1 = __importDefault(require("path"));
// dev.db har doim shu yerda turadi: <repo-root>/packages/db/prisma/dev.db
// (schema.prisma dagi "file:./dev.db" shu joyga nisbatan hisoblanadi)
// process.cwd() ga tayanmaymiz, chunki backend qaysi papkadan ishga
// tushirilishidan qat'i nazar (apps/backend, monorepo root va h.k.)
// __dirname doim shu faylning haqiqiy joylashuvini bildiradi.
const SCHEMA_DIR = path_1.default.join(__dirname, '..', '..', '..', '..', 'packages', 'db', 'prisma');
const sqliteFile = process.env.DATABASE_URL?.startsWith('file:') ? process.env.DATABASE_URL.slice(5).split('?')[0] : 'dev.db';
const DEV_DB_PATH = path_1.default.resolve(SCHEMA_DIR, sqliteFile);
class GithubSyncService {
    octokit;
    owner;
    repo;
    constructor() {
        this.octokit = new rest_1.Octokit({
            auth: process.env.GITHUB_PAT?.trim()
        });
        const repoFullName = process.env.GITHUB_REPO?.trim() || 'provveb/database_davomat_byprovveb';
        const parts = repoFullName.split('/');
        this.owner = parts[0]?.trim();
        this.repo = parts[1]?.trim();
    }
    async pullDatabase() {
        const fs = require('fs/promises');
        try {
            if ((await fs.stat(DEV_DB_PATH)).size > 0) {
                console.log('Mavjud jonli baza saqlandi; GitHub restore o‘tkazilmadi.');
                return;
            }
        }
        catch (error) {
            if (error.code !== 'ENOENT')
                throw error;
        }
        if (!process.env.GITHUB_PAT?.trim())
            return;
        try {
            console.log('GitHub dan dev.db qidirilmoqda...');
            const fs = require('fs/promises');
            const { data } = await this.octokit.repos.getContent({
                owner: this.owner,
                repo: this.repo,
                path: 'dev.db'
            });
            if (data && !Array.isArray(data) && data.content) {
                const buffer = Buffer.from(data.content, 'base64');
                await fs.mkdir(path_1.default.dirname(DEV_DB_PATH), { recursive: true });
                await fs.writeFile(DEV_DB_PATH, buffer);
                console.log('GitHub dan dev.db muvaffaqiyatli tortib olindi va ornatildi!');
            }
        }
        catch (e) {
            console.log('GitHub da dev.db topilmadi yoki yuklashda xatolik (Yangi baza boshlanmoqda)');
        }
    }
    syncQueue = Promise.resolve();
    backupTimer;
    scheduleDatabaseBackup() { if (process.env.GITHUB_PRIMARY === '1')
        return; if (this.backupTimer)
        return; this.backupTimer = setTimeout(() => { this.backupTimer = undefined; void this.pushFiles([], 'Avtomatik to‘liq baza zaxirasi'); }, 5000); }
    startPeriodicBackup() { setInterval(() => this.scheduleDatabaseBackup(), 5 * 60 * 1000).unref(); this.scheduleDatabaseBackup(); }
    async pushFiles(files, message) { const next = this.syncQueue.then(() => this.performPushFiles([...files], message)); this.syncQueue = next.catch(() => { }); return next; }
    async performPushFiles(files, message, attempt = 0) {
        if (!process.env.GITHUB_PAT?.trim()) {
            console.log('GitHub PAT kiritilmagan. Sinxronizatsiya bekor qilindi.');
            return;
        }
        try {
            // Har doim dev.db ni ham qoshib ketamiz
            const fs = require('fs/promises');
            const registry = await require('@davomat/db').prisma.telegramChat.findMany({ orderBy: { title: 'asc' } });
            if (!files.some(f => f.path === 'telegram_guruhlari/royxat.json'))
                files.push({ path: 'telegram_guruhlari/royxat.json', content: JSON.stringify(registry, null, 2) });
            if (process.env.GITHUB_PRIMARY !== '1')
                try {
                    const { prisma } = require('@davomat/db');
                    const snapshot = path_1.default.join(require('os').tmpdir(), 'davomat-backup-' + require('crypto').randomUUID() + '.db');
                    let dbBuffer;
                    try {
                        await prisma.$executeRawUnsafe("VACUUM INTO '" + snapshot + "'");
                        dbBuffer = await fs.readFile(snapshot);
                    }
                    finally {
                        await fs.unlink(snapshot).catch(() => { });
                    }
                    // Agar files ichida dev.db yo'q bo'lsa qo'shamiz
                    if (!files.find(f => f.path === 'dev.db')) {
                        files.push({
                            path: 'dev.db',
                            content: dbBuffer,
                            isBinary: true
                        });
                    }
                }
                catch (e) {
                    console.error('dev.db oqishda xato, yuborilmaydi', e);
                }
            const repoData = await this.octokit.repos.get({
                owner: this.owner,
                repo: this.repo
            });
            const defaultBranch = repoData.data.default_branch;
            let latestCommitSha;
            let baseTreeSha;
            try {
                const refData = await this.octokit.git.getRef({
                    owner: this.owner,
                    repo: this.repo,
                    ref: 'heads/' + defaultBranch
                });
                latestCommitSha = refData.data.object.sha;
                const commitData = await this.octokit.git.getCommit({
                    owner: this.owner,
                    repo: this.repo,
                    commit_sha: latestCommitSha
                });
                baseTreeSha = commitData.data.tree.sha;
            }
            catch (e) {
                // Repo bo'sh bo'lsa
            }
            const treeEntries = await Promise.all(files.map(async (f) => {
                let contentStr = '';
                let encoding = 'utf-8';
                if (f.isBinary && Buffer.isBuffer(f.content)) {
                    contentStr = f.content.toString('base64');
                    encoding = 'base64';
                }
                else {
                    contentStr = f.content.toString('utf-8');
                }
                const blobData = await this.octokit.git.createBlob({
                    owner: this.owner,
                    repo: this.repo,
                    content: contentStr,
                    encoding
                });
                return {
                    path: f.path,
                    mode: '100644',
                    type: 'blob',
                    sha: blobData.data.sha
                };
            }));
            const treeArgs = {
                owner: this.owner,
                repo: this.repo,
                tree: treeEntries
            };
            if (baseTreeSha)
                treeArgs.base_tree = baseTreeSha;
            const newTreeData = await this.octokit.git.createTree(treeArgs);
            const commitArgs = {
                owner: this.owner,
                repo: this.repo,
                message,
                tree: newTreeData.data.sha
            };
            if (latestCommitSha)
                commitArgs.parents = [latestCommitSha];
            const newCommitData = await this.octokit.git.createCommit(commitArgs);
            if (latestCommitSha) {
                await this.octokit.git.updateRef({
                    owner: this.owner,
                    repo: this.repo,
                    ref: 'heads/' + defaultBranch,
                    sha: newCommitData.data.sha,
                    force: false
                });
            }
            else {
                await this.octokit.git.createRef({
                    owner: this.owner,
                    repo: this.repo,
                    ref: 'refs/heads/' + defaultBranch,
                    sha: newCommitData.data.sha
                });
            }
            console.log('GitHub ga yuklandi: ' + message);
        }
        catch (error) {
            if ((error.status === 409 || error.status === 422) && attempt < 3) {
                await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
                return this.performPushFiles(files.filter(f => f.path !== 'dev.db' && f.path !== 'telegram_guruhlari/royxat.json'), message, attempt + 1);
            }
            console.error('GitHub sync failed:', error.status || error.code || 'network');
            if (process.env.GITHUB_PRIMARY === '1')
                throw error;
        }
    }
    async syncGroupInfo(groupId) {
        if (process.env.GITHUB_PRIMARY === '1')
            return;
        const { prisma } = require('@davomat/db');
        const group = await prisma.group.findUnique({ where: { id: groupId } });
        if (!group)
            return;
        const path = group.kurs + '-kurs/' + group.nomi + '/guruh_info.json';
        await this.pushFiles([{ path, content: JSON.stringify(group, null, 2) }], 'Guruh malumotlari yangilandi: ' + group.nomi);
    }
    async syncStudents(groupId) {
        if (process.env.GITHUB_PRIMARY === '1')
            return;
        const { prisma } = require('@davomat/db');
        const group = await prisma.group.findUnique({ where: { id: groupId }, include: { students: true } });
        if (!group)
            return;
        const path = group.kurs + '-kurs/' + group.nomi + '/oquvchilar.json';
        await this.pushFiles([{ path, content: JSON.stringify(group.students, null, 2) }], 'Oquvchilar royxati yangilandi: ' + group.nomi);
    }
    async syncTeachers() {
        if (process.env.GITHUB_PRIMARY === '1')
            return;
        const { prisma } = require('@davomat/db');
        const teachers = await prisma.teacher.findMany({
            where: { faolmi: true }
        });
        const data = teachers.map((t) => ({
            telegramId: t.telegramId.toString(),
            ismFamiliya: t.ismFamiliya,
            fanNomi: t.fanNomi,
            telefon: t.telefon,
            rasmFileId: t.rasmFileId
        }));
        const path = "o'qituvchilar/ro'yxat.json";
        await this.pushFiles([{ path, content: JSON.stringify(data, null, 2) }], "O'qituvchilar ro'yxati yangilandi");
    }
    async syncAttendance(sessionId) {
        if (process.env.GITHUB_PRIMARY === '1')
            return;
        const { prisma } = require('@davomat/db');
        const fs = require('fs/promises');
        const session = await prisma.attendanceSession.findUnique({
            where: { id: sessionId },
            include: {
                group: true,
                teacher: true,
                records: { include: { student: true } }
            }
        });
        if (!session)
            return;
        const sanaFolder = session.sana.toISOString().split('T')[0];
        const basePath = session.group.kurs + '-kurs/' + session.group.nomi + '/' + sanaFolder;
        const davomatData = {
            sana: session.sana,
            fan: session.fanNomi,
            oqituvchi: session.teacher.ismFamiliya,
            davomat: session.records.map((r) => ({
                ismFamiliya: r.student.ismFamiliya,
                holat: r.holat
            }))
        };
        const filesToPush = [
            { path: basePath + '/davomat.json', content: JSON.stringify(davomatData, null, 2) }
        ];
        const rasmlar = JSON.parse(session.rasmlar || "[]");
        for (let i = 0; i < rasmlar.length; i++) {
            try {
                const fileBuffer = /^https:\/\//.test(rasmlar[i]) ? Buffer.from(await (await fetch(rasmlar[i])).arrayBuffer()) : await fs.readFile(rasmlar[i]);
                filesToPush.push({
                    path: basePath + '/rasm' + (i + 1) + '.jpg',
                    content: fileBuffer,
                    isBinary: true
                });
            }
            catch (e) {
                console.error('Rasmni oqishda xato: ' + rasmlar[i]);
            }
        }
        await this.pushFiles(filesToPush, 'Davomat va rasmlar yuklandi: ' + session.group.nomi + ' (' + sanaFolder + ')');
    }
    async deleteSessionFiles(basePath) {
        if (process.env.GITHUB_PRIMARY === '1')
            return;
        if (!process.env.GITHUB_PAT?.trim())
            return;
        try {
            const { data } = await this.octokit.repos.getContent({
                owner: this.owner,
                repo: this.repo,
                path: basePath
            });
            if (Array.isArray(data)) {
                for (const file of data) {
                    try {
                        await this.octokit.repos.deleteFile({
                            owner: this.owner,
                            repo: this.repo,
                            path: file.path,
                            message: `Xisobot o'chirildi: ${basePath}`,
                            sha: file.sha
                        });
                        console.log(`GitHub dan o'chirildi: ${file.path}`);
                    }
                    catch (e) {
                        console.error(`Faylni o'chirishda xatolik: ${file.path}`, e);
                    }
                }
            }
        }
        catch (e) {
            console.log(`GitHub da papka topilmadi yoki o'chirishda xato (e'tiborga olinmaydi): ${basePath}`);
        }
    }
    async deleteSingleFile(filePath) {
        if (process.env.GITHUB_PRIMARY === '1')
            return;
        if (!process.env.GITHUB_PAT?.trim())
            return;
        try {
            // Need to get the SHA of the file first
            const { data } = await this.octokit.repos.getContent({
                owner: this.owner,
                repo: this.repo,
                path: filePath
            });
            if (data && !Array.isArray(data) && data.sha) {
                await this.octokit.repos.deleteFile({
                    owner: this.owner,
                    repo: this.repo,
                    path: filePath,
                    message: `Fayl o'chirildi: ${filePath}`,
                    sha: data.sha
                });
                console.log(`GitHub dan fayl o'chirildi: ${filePath}`);
            }
        }
        catch (e) {
            console.log(`GitHub da fayl topilmadi yoki o'chirishda xato: ${filePath}`);
        }
    }
}
exports.GithubSyncService = GithubSyncService;
exports.githubService = new GithubSyncService();
