export const DEVELOPER_CHAT_ID = '8197301287';
export type MessageRefs = Record<string, number[]>;
export function addMessageRefs(refs: MessageRefs, chat: string, ids: unknown) {
  if (!/^-?\d+$/.test(chat) || !Array.isArray(ids)) return;
  const safe = ids.filter((id): id is number => Number.isSafeInteger(id) && Number(id) > 0);
  if (safe.length) refs[chat] = [...new Set([...(refs[chat] || []), ...safe])];
}
export function reportMessageRefs(session: any, report: any, adminChat?: string) {
  const refs: MessageRefs = {}, unknown = new Set<string>();
  for (const [chat, ids] of Object.entries(report.messages || {})) addMessageRefs(refs, chat, ids);
  for (const [key, ids] of Object.entries(report.albumMessageIds || {})) addMessageRefs(refs, key.slice(key.indexOf(':') + 1), ids);
  const adminKey = Object.keys(report.progress || {}).find(key => key.startsWith('admin:'));
  try { addMessageRefs(refs, adminKey ? adminKey.slice(6) : adminChat || '', JSON.parse(session.telegramMessageIds || '[]')); } catch { /* Older rows may have no IDs. */ }
  for (const [key, cursor] of Object.entries(report.progress || {})) {
    if (!Number(cursor)) continue;
    const chat = key.slice(key.indexOf(':') + 1);
    if (chat === DEVELOPER_CHAT_ID) continue;
    const tracked = report.trackingVersion === 1 && (report.messages?.[chat]?.length || 0) > 0;
    const albumOnly = report.deliveryVersion === 2 && Number(cursor) === 1 && (report.albumMessageIds?.[key]?.length || 0) > 0;
    const legacyAdmin = key.startsWith('admin:') && refs[chat]?.length;
    if (!tracked && !albumOnly && !legacyAdmin) unknown.add(chat);
  }
  for (const chat of report.parentDelivered || []) if (chat !== DEVELOPER_CHAT_ID && !refs[chat]?.length) unknown.add(chat);
  // Very old reports stored only a final flag, so no recipient/message IDs can be reconstructed safely.
  if (report.trackingVersion !== 1 && (report.parentsDone || (!report.deliveryVersion && !report.trackingVersion && !Object.keys(report.progress || {}).length && Object.keys(refs).length)) && !Object.keys(report.progress || {}).some(k => k.startsWith('parent:')) && !(report.parentDelivered || []).length) {
    let chats: string[] = []; try { chats = JSON.parse(session.group?.telegramChatIds || '[]'); } catch {}
    if (!chats.length && session.group?.telegramChatId) chats = [session.group.telegramChatId];
    for (const chat of chats) if (chat !== DEVELOPER_CHAT_ID && !refs[chat]?.length) unknown.add(chat);
  }
  return { refs, unknownChats: [...unknown] };
}
export function deletionView(row: any) {
  const data = JSON.parse(row.tafsilot || '{}'), targets = data.targets || {};
  const deleted = Object.keys(data.deleted || {}).length, failed = Object.keys(data.failed || {}).length;
  const total = Object.entries(targets).filter(([chat]) => chat !== DEVELOPER_CHAT_ID).reduce((n, [, ids]) => n + (Array.isArray(ids) ? ids.length : 0), 0);
  return { id: row.id, sessionId: data.sessionId, groupName: data.groupName, status: row.harakat,
    createdAt: row.vaqt, total, deleted, failed, unknownChats: data.unknownChats || [],
    archiveSaved: !!data.archiveDone, waiting: data.waiting || null, retryAt: data.nextAt || null };
}
