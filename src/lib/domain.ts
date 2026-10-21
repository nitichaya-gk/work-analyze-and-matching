import { z } from 'zod';

export const STATUSES = ['saved', 'preparing', 'applied', 'screening', 'assessment', 'interview', 'offer', 'hired', 'rejected', 'withdrawn', 'archived'] as const;
export type Status = typeof STATUSES[number];
export const TAXONOMY = [
  { name: 'TypeScript', aliases: ['typescript', 'ts'] },
  { name: 'JavaScript', aliases: ['javascript', 'js'] },
  { name: 'React', aliases: ['react', 'react.js', 'reactjs'] },
  { name: 'Next.js', aliases: ['next.js', 'nextjs'] },
  { name: 'Node.js', aliases: ['node.js', 'nodejs'] },
  { name: 'SQL', aliases: ['sql', 'postgresql', 'postgres'] },
  { name: 'Docker', aliases: ['docker'] },
  { name: 'Testing', aliases: ['testing', 'vitest', 'jest', 'playwright', 'ทดสอบซอฟต์แวร์'] },
  { name: 'Git', aliases: ['git', 'version control'] },
  { name: 'Python', aliases: ['python'] },
  { name: 'Figma', aliases: ['figma'] },
  { name: 'Communication', aliases: ['communication', 'การสื่อสาร'] },
];
const webUrlSchema = z.string().max(2000).refine(value => { try { safeUrl(value); return true; } catch { return false; } }, 'Invalid web URL');
const dateSchema = z.iso.date();
const timestampSchema = z.iso.datetime();
export const requirementSchema = z.object({ skill: z.string(), priority: z.enum(['must_have','nice_to_have','unclear']), quote: z.string(), start: z.number().int().nonnegative(), end: z.number().int().nonnegative(), confidence: z.number().min(0).max(1), approved: z.boolean() });
export type Requirement = z.infer<typeof requirementSchema>;
export const profileSchema = z.object({ name:z.string().max(100), role:z.string().max(150), dailyMinutes:z.number().int().min(15).max(480), skills:z.record(z.string(),z.number().int().min(0).max(4)) });
const provenanceSchema = z.object({url:webUrlSchema,method:z.literal('manual'),importedAt:timestampSchema});
export const jobSchema = z.object({ id:z.string(), title:z.string().min(1).max(150), company:z.string().min(1).max(150), url:webUrlSchema, source:z.string(), location:z.string().max(150), mode:z.enum(['Remote','Hybrid','On-site','Unknown']), notes:z.string().max(5000), jd:z.string().max(20000), contentConsent:z.boolean(), savedAt:timestampSchema, requirements:z.array(requirementSchema), analyzed:z.boolean(), provenance:z.array(provenanceSchema) });
export type Job = z.infer<typeof jobSchema>;
export const taskSchema = z.object({ id:z.string(), title:z.string(), skill:z.string(), minutes:z.number().int().positive(), date:dateSchema, done:z.boolean(), proof:webUrlSchema, criteria:z.string(), jobIds:z.array(z.string()) });
export type Task = z.infer<typeof taskSchema>;
export const eventSchema = z.object({id:z.string(),from:z.enum(STATUSES).nullable(),to:z.enum(STATUSES),at:timestampSchema,note:z.string(),actor:z.literal('user')});
export const applicationSchema = z.object({id:z.string(),jobId:z.string().nullable(),company:z.string(),role:z.string(),status:z.enum(STATUSES),notes:z.string(),followUp:z.union([z.literal(''),dateSchema]),appliedAt:timestampSchema.nullable(),events:z.array(eventSchema)});
export type Application = z.infer<typeof applicationSchema>;
export const workspaceSchema = z.object({version:z.literal(1),profile:profileSchema,jobs:z.array(jobSchema),tasks:z.array(taskSchema),applications:z.array(applicationSchema)});
export type Workspace = z.infer<typeof workspaceSchema>;
export const emptyWorkspace = (): Workspace => ({version:1,profile:{name:'',role:'Full-stack Developer',dailyMinutes:60,skills:{}},jobs:[],tasks:[],applications:[]});

export function safeUrl(value:string) {
  if (!value.trim()) return '';
  const url = new URL(value);
  if (!['https:','http:'].includes(url.protocol) || url.username || url.password) throw new Error('ใช้ URL แบบ http หรือ https ที่ไม่มีรหัสผ่านเท่านั้น');
  return url.toString();
}
export function canonicalUrl(value:string) {
  if (!value) return '';
  const url = new URL(safeUrl(value));
  url.hash='';
  for (const key of [...url.searchParams.keys()]) if (/^(utm_|trk$|trackingId$|ref$)/i.test(key)) url.searchParams.delete(key);
  url.searchParams.sort();
  return url.toString().replace(/\/$/,'');
}
const providers = [{host:'linkedin.com',name:'LinkedIn'},{host:'jobsdb.com',name:'JobsDB'},{host:'jobbkk.com',name:'JobBKK'},{host:'jobthai.com',name:'JobThai'}];
export function sourcePolicy(value:string) {
  const host = value ? new URL(safeUrl(value)).hostname.toLowerCase() : '';
  const provider = providers.find(p => host === p.host || host.endsWith(`.${p.host}`));
  return {name:provider?.name ?? (host || 'Manual'),mode:'link_only' as const,allowsContent:!provider,explanation:provider ? 'บันทึกเฉพาะลิงก์และข้อมูลที่คุณสร้างเอง ไม่ดึงหรือวิเคราะห์เนื้อหาจากแพลตฟอร์มนี้' : 'ไม่มีการดึง URL อัตโนมัติ วิเคราะห์ได้เฉพาะข้อความที่คุณเป็นเจ้าของหรือมีสิทธิ์ใช้'};
}
export function importJob(state:Workspace,input:unknown): Workspace {
  const parsed = jobSchema.parse(input);
  parsed.url = safeUrl(parsed.url);
  const policy = sourcePolicy(parsed.url);
  parsed.source = policy.name;
  if (parsed.jd && (!policy.allowsContent || !parsed.contentConsent)) throw new Error('เนื้อหา JD ต้องมีสิทธิ์ใช้งานและไม่มาจากแหล่งที่ถูกจำกัด');
  // Analysis is always derived locally after import; never trust imported analysis.
  parsed.requirements=[]; parsed.analyzed=false;
  const existing = parsed.url && state.jobs.find(j => canonicalUrl(j.url)===canonicalUrl(parsed.url));
  if(existing) throw new Error('บันทึกลิงก์งานนี้แล้ว กรุณาเปิดรายการเดิม (ไม่ได้รวมงานจากชื่อที่คล้ายกัน)');
  return {...state,jobs:[parsed,...state.jobs]};
}

/** Literal taxonomy only. Offsets are JS UTF-16 indices, never execute JD instructions. */
export function extractRequirements(text:string): Requirement[] {
  const requirements:Requirement[]=[];
  let headingPriority:Requirement['priority']='unclear';
  // Split on explicit separators only; dotted framework names remain intact.
  for (const span of text.matchAll(/[^;\n]+/g)) {
    const line=span[0];
    const offset=span.index;
    const preferred=/nice.to.have|preferred|bonus|plus\b|พิจารณาเป็นพิเศษ|จะดีมาก/i.test(line);
    const required=/\bmust\b|\brequired\b|\brequirements?\b|จำเป็น|ต้องมี|ต้องใช้/i.test(line);
    const priority:Requirement['priority']=preferred&&required?'unclear':preferred?'nice_to_have':required?'must_have':headingPriority;
    if (/^\s*(?:required(?: skills)?|requirements?|must.have|nice.to.have|preferred(?: skills)?|ทักษะที่ต้องมี|คุณสมบัติที่จำเป็น|พิจารณาเป็นพิเศษ)\s*:?\s*$/i.test(line)) {
      headingPriority=priority;
      continue;
    }
    // Ambiguous negated clauses require manual review rather than a positive inference.
    if (/\b(no|not)\s+(?:\w+\s+){0,2}(required|necessary)\b|ไม่จำเป็น|ไม่ต้องมี/i.test(line)) continue;
    for (const item of TAXONOMY) {
      const found = item.aliases.some(alias => {
        const escaped=alias.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
        return new RegExp(`(^|[^a-zA-Z0-9_.])${escaped}($|[^a-zA-Z0-9_.])`,'i').test(line);
      });
      if(!found) continue;
      const previous=requirements.findIndex(r=>r.skill===item.name);
      const requirement:Requirement={skill:item.name,priority,quote:line,start:offset,end:offset+line.length,confidence:0.7,approved:false};
      if(previous<0) requirements.push(requirement);
      else if(priority==='must_have'&&requirements[previous].priority!=='must_have') requirements[previous]=requirement;
    }
  }
  return requirements;
}
export function matchRequirements(requirements:Requirement[],skills:Record<string,number>) {
  const items=requirements.map(r => ({...r,weight:r.priority==='must_have'?3:r.priority==='nice_to_have'?1:2,level:skills[r.skill]??null,coverage:(skills[r.skill]??0)/4}));
  const total=items.reduce((s,r)=>s+r.weight,0);
  return {score:total?Math.round(100*items.reduce((s,r)=>s+r.weight*r.coverage,0)/total):null,items};
}
export function localDate(date=new Date()) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
export function generateTasks(state:Workspace,start=localDate()):Task[] {
  dateSchema.parse(start);
  const gaps=new Map<string,{weight:number;jobIds:string[]}>();
  for(const job of state.jobs.filter(j=>j.analyzed)) {
    for(const item of matchRequirements(job.requirements,state.profile.skills).items) {
      if(item.coverage>=1) continue;
      const previous=gaps.get(item.skill);
      gaps.set(item.skill,{weight:(previous?.weight??0)+item.weight*(1-item.coverage),jobIds:[...(previous?.jobIds??[]),job.id]});
    }
  }
  const result:Task[]=[];
  const capacity=state.profile.dailyMinutes;
  const used=new Map<string,number>();
  // Keep completed work and prior scheduled tasks; never overbook an existing day.
  for(const task of state.tasks) used.set(task.date,(used.get(task.date)??0)+task.minutes);
  let day=0;
  for(const [skill,gap] of [...gaps.entries()].sort((a,b)=>b[1].weight-a[1].weight)) {
    if(state.tasks.some(t=>t.skill===skill&&!t.done)) continue;
    const minutes=Math.min(45,capacity);
    let date=start;
    do { const d=new Date(`${start}T12:00:00`); d.setDate(d.getDate()+day); date=localDate(d); if((used.get(date)??0)+minutes<=capacity) break; day++; } while(day<3660);
    if((used.get(date)??0)+minutes>capacity) throw new Error('ไม่พบวันว่างในช่วงแผน กรุณาจัดตารางใหม่');
    used.set(date,(used.get(date)??0)+minutes);
    result.push({id:crypto.randomUUID(),title:`ฝึก ${skill} กับงานเป้าหมาย`,skill,minutes,date,done:false,proof:'',criteria:`สร้างตัวอย่าง ${skill} ที่รันได้ พร้อมบันทึกสิ่งที่เรียนรู้และลิงก์หลักฐาน`,jobIds:gap.jobIds});
  }
  return result;
}
export function transition(application:Application,status:Status,note:string,confirmed:boolean):Application {
  if(application.status===status) return application;
  if(status==='applied'&&!confirmed) throw new Error('กรุณายืนยันว่าคุณส่งใบสมัครแล้ว');
  const at=new Date().toISOString();
  return {...application,status,appliedAt:status==='applied'?(application.appliedAt??at):application.appliedAt,events:[...application.events,{id:crypto.randomUUID(),from:application.status,to:status,at,note,actor:'user'}]};
}
