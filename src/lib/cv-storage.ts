import { z } from 'zod';

const DATABASE = 'careeros.documents.v1';
const STORE = 'cvs';
export const MAX_CV_BYTES = 10 * 1024 * 1024;
export const CV_ACCEPT = '.pdf,.docx,.txt';
const recordSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  type: z.string(),
  size: z.number().int().positive().max(MAX_CV_BYTES),
  addedAt: z.iso.datetime(),
  blob: z.instanceof(Blob),
});
export type StoredCv = z.infer<typeof recordSchema>;

/** Validate common file signatures; files are stored as inert blobs, never executed. */
export async function validateCv(file: File): Promise<string> {
  if (!file.size) throw new Error('ไฟล์ว่าง กรุณาเลือก CV ที่มีเนื้อหา');
  if (file.size > MAX_CV_BYTES) throw new Error('ไฟล์ต้องมีขนาดไม่เกิน 10 MB');
  if (file.name.length > 255) throw new Error('ชื่อไฟล์ยาวเกินไป กรุณาเปลี่ยนชื่อให้สั้นลง');
  const extension = file.name.split('.').pop()?.toLowerCase();
  const bytes = new Uint8Array(await file.slice(0, 1024).arrayBuffer());
  if (extension === 'pdf' && new TextDecoder().decode(bytes.slice(0, 5)) === '%PDF-') return 'application/pdf';
  if (extension === 'docx' && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 3 && bytes[3] === 4) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  if (extension === 'txt' && !bytes.includes(0)) return 'text/plain';
  throw new Error('รองรับ PDF, DOCX หรือ TXT เท่านั้น กรุณาตรวจชนิดและเนื้อหาไฟล์');
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('browser นี้ไม่รองรับการจัดเก็บไฟล์ IndexedDB'));
      return;
    }
    let settled = false;
    const timer = setTimeout(() => {
      settled = true;
      reject(new Error('เปิดที่เก็บ CV ไม่สำเร็จ ลองปิดแท็บ CareerOS อื่นแล้วลองใหม่'));
    }, 8000);
    let request: IDBOpenDBRequest;
    try { request = indexedDB.open(DATABASE, 1); }
    catch (error) { clearTimeout(timer); reject(error); return; }
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => {
      clearTimeout(timer);
      const database = request.result;
      if (settled) { database.close(); return; }
      settled = true;
      database.onversionchange = () => database.close();
      resolve(database);
    };
    request.onerror = () => {
      clearTimeout(timer);
      if (settled) return;
      settled = true;
      reject(request.error ?? new Error('เปิดที่เก็บ CV ไม่สำเร็จ'));
    };
  });
}

async function transact<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const database = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(STORE, mode);
      const request = operation(transaction.objectStore(STORE));
      // Report success after the transaction commits, including quota errors at commit time.
      transaction.oncomplete = () => resolve(request.result);
      transaction.onabort = () => reject(transaction.error ?? new Error('จัดเก็บ CV ไม่สำเร็จ'));
    });
  } finally {
    database.close();
  }
}

export async function listCvs(): Promise<StoredCv[]> {
  const records = await transact('readonly', store => store.getAll());
  return z.array(recordSchema).parse(records).sort((a, b) => b.addedAt.localeCompare(a.addedAt));
}

export async function storeCv(file: File, signal?: AbortSignal): Promise<StoredCv> {
  const type = await validateCv(file);
  signal?.throwIfAborted();
  const record: StoredCv = {
    id: crypto.randomUUID(), name: file.name, type, size: file.size,
    addedAt: new Date().toISOString(), blob: file.slice(0, file.size, type),
  };
  await transact('readwrite', store => {
    signal?.throwIfAborted();
    return store.add(recordSchema.parse(record));
  });
  return record;
}

export async function deleteCv(id: string): Promise<void> {
  await transact('readwrite', store => store.delete(id));
}

export async function clearCvs(): Promise<void> {
  await transact('readwrite', store => store.clear());
}

export function downloadCv(cv: StoredCv): void {
  const url = URL.createObjectURL(cv.blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = cv.name;
  document.body.appendChild(anchor);
  try { anchor.click(); }
  finally { anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
}
