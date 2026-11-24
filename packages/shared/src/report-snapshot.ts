// Keep only report fields; Date is JSON-safe and database BigInt fields are excluded.
export function attendanceSnapshot(session: any) {
  return {
    id: session.id, sana: session.sana, boshlanganVaqt: session.boshlanganVaqt,
    yakunlanganVaqt: session.yakunlanganVaqt, fanNomi: session.fanNomi, rasmlar: session.rasmlar,
    group: { nomi: session.group.nomi, sinfRahbariIsmi: session.group.sinfRahbariIsmi },
    teacher: { ismFamiliya: session.teacher.ismFamiliya },
    records: (session.records || []).map((r: any) => ({ holat: r.holat, student: { ismFamiliya: r.student.ismFamiliya } })),
  };
}
