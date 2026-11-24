export const GROUP_POLICY_ID='teacher-group-policy';
export async function teacherGroupsEnabled(db:any):Promise<boolean>{const row=await db.notification.findUnique({where:{id:GROUP_POLICY_ID}});return row?.tafsilot!=='disabled';}
export async function setTeacherGroupsEnabled(db:any,enabled:boolean,actor:string){const data={harakat:'TEACHER_GROUP_POLICY',tafsilot:enabled?'enabled':'disabled',kimTomonidan:actor};await db.notification.upsert({where:{id:GROUP_POLICY_ID},create:{id:GROUP_POLICY_ID,...data},update:data});return enabled;}
