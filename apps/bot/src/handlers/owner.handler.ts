import {Context} from 'grammy';
import {performance} from 'perf_hooks';
import {runtimeDiagnostics,escapeHtml} from '../services/diagnostics.service';
import {prisma} from '@davomat/db';
import {keyboardFor} from './group.handler';
import {canManageGroups,isGroupAdmin,registrationIds} from '../services/chat-registry.service';

export async function systemStatusHandler(ctx:Context){
 if(ctx.chat?.type!=='private'||ctx.from?.id!==8197301287)return;
 const start=performance.now();await prisma.$queryRawUnsafe('SELECT 1');const dbMs=(performance.now()-start).toFixed(1);
 const [admins,teachers,groups,students,chats,sessions,records,notices,announcements,info]=await Promise.all([
  prisma.admin.count({where:{faolmi:true}}),prisma.teacher.count({where:{faolmi:true,deletedAt:null}}),
  prisma.group.count({where:{faolmi:true}}),prisma.student.count(),prisma.telegramChat.count({where:{active:true}}),
  prisma.attendanceSession.count(),prisma.attendanceRecord.count(),
  prisma.notification.count({where:{harakat:{in:['ACCESS_NOTICE_PENDING','ACCESS_NOTICE_WAITING_START','ATTENDANCE_REPORT_PENDING']}}}),
  prisma.notification.count({where:{harakat:{in:['ANNOUNCEMENT_PENDING','ANNOUNCEMENT_DONE_NOTICE']}}}),
  Promise.resolve((ctx as any).auditDiagnostics)
 ]);
 const h=escapeHtml;
 const text=`⚡️ <b>TIZIMNING TO'LIQ DIAGNOSTIKASI</b> ⚡️

🖥 <b>SERVER RESURSLARI</b>
• ⚙️ <b>OS:</b> ${h(info.os)}
• 🧠 <b>CPU:</b> ${h(info.cpu)}
• 📉 <b>CPU Yuklamasi:</b> ${info.load}; load 1/5/15 min: ${info.loadavg}
• 🔋 <b>RAM:</b> ${info.ram}
• 💾 <b>ROM (Disk):</b> ${info.disk}
• ⏱ <b>Uptime:</b> ${info.uptime}

🛠 <b>Dastur (Node.js) Holati</b>
• 🟢 <b>Status:</b> ✅ ONLINE — ${process.version}
• 📦 <b>Xotira (Heap):</b> ${info.heap}
• 🗂 <b>Xotira (RSS):</b> ${info.rss}
• ⚡️ <b>Ping:</b> ${info.api.ms} ms (ichki API)
• ⏱ <b>Bot Uptime:</b> ${info.nodeUptime}

💾 <b>MA'LUMOTLAR BAZASI (SQLite)</b>
• 🟢 <b>Holati:</b> ✅ ONLINE
• ⚡️ <b>Javob tezligi:</b> ${dbMs} ms (SELECT 1)
• 👨‍💼 <b>Adminlar:</b> ${admins} faol
• 👨‍🏫 <b>O'qituvchilar:</b> ${teachers} faol
• 📚 <b>Guruhlar:</b> ${groups} faol
• 🎓 <b>O'quvchilar:</b> ${students}
• 📊 <b>Davomatlar:</b> ${sessions} sessiya / ${records} yozuv
• 👥 <b>Ulangan guruhlar:</b> ${chats}
• 📨 <b>Xabar / e’lon navbati:</b> ${notices} / ${announcements}
• ☁️ <b>Saqlash:</b> ${process.env.GITHUB_PRIMARY==='1'?'GitHub → vaqtinchalik RAM; joriy o‘qish muvaffaqiyatli':'mahalliy sinov rejimi'}

🌐 <b>TARMOQ VA WEB</b>
• 🔗 <b>API Ulanishi:</b> ${info.api.ok?'✅ Faol':'⚠️ Xatolik'}
• 🌍 <b>Domen:</b> ${info.web.ok?'✅':'⚠️'} davomat.provveb.uz (${info.web.ms} ms)
• 🛡 <b>SSL Sertifikat:</b> ${info.ssl.ok?`✅ Faol (HTTPS), ${info.ssl.days} kun qoldi`:'⚠️ Tasdiqlanmadi'}

${info.issues.length===0?'✅ Tekshirilgan xizmatlar ishlayapti; diagnostikada xatolik aniqlanmadi.':'⚠️ Aniqlangan holatlar: '+h(info.issues.join('; '))}
🕒 ${new Date().toLocaleString('uz-UZ',{timeZone:'Asia/Tashkent'})}`;
 return ctx.reply(text,{parse_mode:'HTML',reply_markup:keyboardFor(ctx.from.id)});
}

export async function linkedGroupsHandler(ctx:Context){
 if(ctx.chat?.type!=='private'||!await canManageGroups(ctx.from?.id))return;
 const all=await prisma.telegramChat.findMany({where:{active:true}}),admin=await isGroupAdmin(ctx.from!.id);
 const groups=(admin?all:all.filter(c=>registrationIds(c.addedByTelegramIds).includes(String(ctx.from!.id))))
  .sort((a,b)=>a.title.localeCompare(b.title,'uz',{numeric:true}));
 let page=`📋 ${admin?'Barcha ulangan':'Siz qo‘shgan'} ota-onalar guruhlari: ${groups.length} ta.\n`;
 for(let i=0;i<groups.length;i++){
  const line=`\n${i+1}. ${groups[i].title.slice(0,255)} — ${groups[i].chatId}`;
  if(page.length+line.length>3500){await ctx.reply(page);page='📋 Ro‘yxat davomi:\n';}
  page+=line;
 }
 return ctx.reply(page+(groups.length?'':'\nHozircha ulangan guruh yo‘q.'),{reply_markup:keyboardFor(ctx.from?.id)});
}
