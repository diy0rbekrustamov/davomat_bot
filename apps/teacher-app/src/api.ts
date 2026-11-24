const readCache=new Map<string,{expiresAt:number;response:Response}>();
function readCacheKey(input:RequestInfo|URL,init:RequestInit){const url=typeof input==='string'?input:input instanceof URL?input.href:input.url;const headers=new Headers(init.headers||(typeof Request!=='undefined'&&input instanceof Request?input.headers:undefined));return `${url}\n${headers.get('authorization')||''}\n${headers.get('x-app-view')||''}`;}
async function apiFetch(input:RequestInfo|URL,init:RequestInit={}){let res:Response;const method=(init.method||'GET').toUpperCase(),mutating=!['GET','HEAD'].includes(method),cacheable=method==='GET';const key=cacheable?readCacheKey(input,init):'';if(cacheable){const cached=readCache.get(key);if(cached&&cached.expiresAt>Date.now())return cached.response.clone();if(cached)readCache.delete(key);}try{res=await globalThis.fetch(input,{...init,signal:init.signal||AbortSignal.timeout(mutating?120000:45000)});}catch{throw new Error(mutating?'Ulanish uzildi. Saqlash natijasini tekshirish uchun holatni yangilang; amalni takrorlamang.':'Ma’lumotlarni yuklab bo‘lmadi. Ulanishni tekshirib sahifani yangilang.');}if(!res.ok){let body:any;try{body=await res.json();}catch{}throw new Error(body?.message||(res.status===401||res.status===403?'Sessiya yoki ruxsat tekshirilmadi. Mini Appni bot orqali qayta oching.':'Server vaqtincha javob bermayapti. Holatni yangilang.'));}if(mutating)readCache.clear();else if(cacheable&&res.headers.get('content-type')?.includes('application/json')){const now=Date.now();for(const [cacheKey,item]of readCache)if(item.expiresAt<=now)readCache.delete(cacheKey);if(readCache.size>=100)readCache.delete(readCache.keys().next().value!);readCache.set(key,{expiresAt:now+3000,response:res.clone()});}return res;}
import WebApp from './telegram';

const BASE_URL = '/api';

function getHeaders() {
  return {
    'Content-Type': 'application/json',
    'X-App-View': 'teacher',
    'Authorization': `tma ${WebApp.initData}`,
  };
}

export const api = {
  getGroupsPage: async () => {
    const res = await apiFetch(`${BASE_URL}/groups/page-data`, { headers: getHeaders() });
    return res.json();
  },
  updateStudent: async (id: string, ismFamiliya: string) => {
    const res = await apiFetch(`${BASE_URL}/students/${id}`, { method: 'PATCH', headers: getHeaders(), body: JSON.stringify({ ismFamiliya }) });
    return res.json();
  },
  getGroups: async () => {
    const res = await apiFetch(`${BASE_URL}/groups`, { headers: getHeaders() });
    if (!res.ok) throw new Error((await res.json()).message || 'Xatolik');
    return res.json();
  },
  getGroupById: async (id: string) => {
    const res = await apiFetch(`${BASE_URL}/groups/${id}`, { headers: getHeaders() });
    if (!res.ok) throw new Error((await res.json()).message || 'Xatolik');
    return res.json();
  },
  getTelegramChats: async () => {
    const res = await apiFetch(`${BASE_URL}/groups/telegram-chats`, { headers: getHeaders() });
    if (!res.ok) throw new Error((await res.json()).message || 'Xatolik');
    return res.json();
  },
  getTeachers: async () => {
    const res=await apiFetch(`${BASE_URL}/teachers`,{headers:getHeaders()});
    if(!res.ok)throw new Error((await res.json()).message||"O'qituvchi profili yuklanmadi");return res.json();
  },
  deleteStudent:async(id:string)=>{const res=await apiFetch(`${BASE_URL}/students/${id}`,{method:'DELETE',headers:getHeaders()});if(!res.ok)throw new Error((await res.json()).message||"O'quvchi o'chirilmadi");return res.json();},
  createGroup: async (data: any) => {
    const res = await apiFetch(`${BASE_URL}/groups`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error((await res.json()).message || 'Xatolik');
    return res.json();
  },
  updateGroup: async (id: string, data: any) => {
    const res = await apiFetch(`${BASE_URL}/groups/${id}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error((await res.json()).message || 'Xatolik');
    return res.json();
  },
  deleteGroup: async (id: string) => {
    const res = await apiFetch(`${BASE_URL}/groups/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    if (!res.ok) throw new Error((await res.json()).message || 'Xatolik');
    return res.json();
  },
  importStudents: async (groupId: string, file: File, replace: boolean = false) => {
    const formData = new FormData();
    formData.append('file', file);
    if (replace) formData.append('replace', 'true');
    
    const res = await apiFetch(`${BASE_URL}/groups/${groupId}/students/import`, {
      method: 'POST',
      headers: {
        'Authorization': `tma ${WebApp.initData}`,
        'X-App-View': 'teacher',
      },
      body: formData
    });
    if (!res.ok) throw new Error((await res.json()).message || 'Xatolik');
    return res.json();
  },
  addStudent: async (groupId: string, data: { ismFamiliya: string }) => {
    const res = await apiFetch(`${BASE_URL}/groups/${groupId}/students`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error((await res.json()).message || 'Xatolik');
    return res.json();
  },
  sendQrToTelegram: async (base64: string, nomi: string) => {
    const res = await apiFetch(`${BASE_URL}/groups/send-qr`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ base64, nomi })
    });
    if (!res.ok) throw new Error((await res.json()).message || 'Xatolik');
    return res.json();
  },
  sendQrZipToTelegram: async (base64: string) => {
    const res = await apiFetch(`${BASE_URL}/groups/send-qr-zip`, {
      method: 'POST', headers: getHeaders(), body: JSON.stringify({ base64 })
    });
    if (!res.ok) throw new Error((await res.json()).message || 'ZIP yuborilmadi');
    return res.json();
  }
};
