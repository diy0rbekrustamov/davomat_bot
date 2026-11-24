"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.attendanceText = attendanceText;
exports.textChunks = textChunks;
function attendanceText(session, parents = false) {
    const records = session.records || [];
    const present = records.filter((r) => r.holat === 'BOR').length;
    const absent = records.filter((r) => r.holat === 'YOQ');
    const date = (v) => new Date(v).toLocaleDateString('uz-UZ', { timeZone: 'Asia/Tashkent' });
    const time = (v) => v ? new Date(v).toLocaleTimeString('uz-UZ', { timeZone: 'Asia/Tashkent', hour: '2-digit', minute: '2-digit' }) : '—';
    return `📅 Sana: ${date(session.sana)}\n⏰ Vaqt: ${time(session.boshlanganVaqt)} – ${time(session.yakunlanganVaqt)}\n\n👥 Guruh: ${session.group.nomi}\n👤 Sinf rahbari: ${session.group.sinfRahbariIsmi}\n📚 Fan: ${session.fanNomi}\n👨‍🏫 O'qituvchi: ${session.teacher.ismFamiliya}\n\n📊 Statistika:\nJami: ${records.length} ta\nKeldi: ${present} ta\nYo'q: ${absent.length} ta\n${parents ? '' : `Davomat: ${records.length ? Math.round(present / records.length * 100) : 0}%\n`}\n❌ ${parents ? "Darsda yo'qlar" : "Yo'q bo'lganlar"}:\n${absent.length ? absent.map((r, i) => `${i + 1}. ${r.student.ismFamiliya}`).join('\n') : 'Barcha qatnashyapti 💯'}`;
}
function textChunks(text, limit = 3500) {
    const result = [];
    while (text.length > limit) {
        let end = text.lastIndexOf('\n', limit);
        if (end < limit / 2)
            end = limit;
        if (/[\uD800-\uDBFF]/.test(text[end - 1]))
            end--;
        result.push(text.slice(0, end));
        text = text.slice(end).replace(/^\n/, '');
    }
    if (text)
        result.push(text);
    return result;
}
