'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowDownToLine, FileText, Trash2, Upload } from 'lucide-react';
import { Button } from './ui/button';
import { Dialog } from './ui/dialog';
import { CV_ACCEPT, deleteCv, downloadCv, listCvs, storeCv, type StoredCv } from '@/lib/cv-storage';

export function CvLibrary() {
  const [files, setFiles] = useState<StoredCv[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [deleting, setDeleting] = useState<StoredCv | null>(null);
  const mounted = useRef(false);
  const locked = useRef(false);
  const uploadController = useRef<AbortController | null>(null);

  useEffect(() => {
    let active = true;
    mounted.current = true;
    uploadController.current = new AbortController();
    listCvs().then(records => { if (active) setFiles(records); })
      .catch(() => { if (active) setError('อ่าน CV ไม่สำเร็จ กรุณาโหลดหน้านี้ใหม่ หรือตรวจการอนุญาตจัดเก็บข้อมูลของ browser'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; mounted.current = false; uploadController.current?.abort(); };
  }, []);

  async function upload(file: File) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true); setError(''); setNotice('');
    try {
      const saved = await storeCv(file, uploadController.current?.signal);
      if (mounted.current) {
        setFiles(previous => [saved, ...previous]);
        setNotice(`เก็บ ${saved.name} ใน browser แล้ว`);
      }
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error && !(cause instanceof DOMException)
        ? cause.message : 'เก็บ CV ไม่สำเร็จ พื้นที่อาจเต็มหรือ browser ปิดกั้นการจัดเก็บ ไฟล์ยังไม่ได้บันทึก');
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  async function remove() {
    if (!deleting || locked.current) return;
    locked.current = true;
    setBusy(true); setError(''); setNotice('');
    const file = deleting;
    try {
      await deleteCv(file.id);
      if (mounted.current) {
        setFiles(previous => previous.filter(item => item.id !== file.id));
        setDeleting(null);
        setNotice(`ลบ ${file.name} แล้ว`);
      }
    } catch {
      if (mounted.current) setError('ลบ CV ไม่สำเร็จ กรุณาลองอีกครั้ง');
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  return <section className="panel form-panel cv-library" aria-labelledby="cv-heading">
    <span className="eyebrow">YOUR DOCUMENTS</span>
    <h2 id="cv-heading">CV ของคุณ</h2>
    <p className="muted">เก็บไฟล์ใน browser นี้ เปิดครั้งหน้าก็ยังอยู่ รองรับ PDF, DOCX และ TXT ไม่เกิน 10 MB ต่อไฟล์</p>
    <label className="cv-upload">
      <Upload size={22} aria-hidden="true"/>
      <span>{busy ? 'กำลังจัดการไฟล์…' : 'เลือกไฟล์ CV เพื่อเก็บไว้'}</span>
      <input type="file" accept={CV_ACCEPT} disabled={loading || busy}
        aria-label="อัปโหลด CV" onChange={event => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = '';
          if (file) void upload(file);
        }}/>
    </label>
    {loading && <p role="status">กำลังอ่านรายการ CV…</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {notice && <p className="muted" role="status">{notice}</p>}
    {!loading && !files.length && <p className="muted">ยังไม่มี CV ที่เก็บไว้</p>}
    <ul className="cv-files">
      {files.map(file => <li key={file.id}>
        <FileText size={22} aria-hidden="true"/>
        <div className="cv-file-info"><strong>{file.name}</strong>
          <small>{new Intl.NumberFormat('th-TH', { maximumFractionDigits: 1 }).format(file.size / 1024)} KB · {new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium' }).format(new Date(file.addedAt))}</small>
        </div>
        <div className="cv-file-actions">
          <Button variant="secondary" disabled={busy} aria-label={`ดาวน์โหลด ${file.name}`} onClick={() => {
            try { downloadCv(file); } catch { setError('ดาวน์โหลด CV ไม่สำเร็จ กรุณาลองอีกครั้ง'); }
          }}><ArrowDownToLine size={16}/>ดาวน์โหลด</Button>
          <Button variant="ghost" disabled={busy} aria-label={`ลบ ${file.name}`} onClick={() => setDeleting(file)}><Trash2 size={16}/>ลบ</Button>
        </div>
      </li>)}
    </ul>
    <p className="muted cv-storage-note">ไฟล์อยู่ในอุปกรณ์และ browser นี้ ไม่มีการส่งไป server หรือ AI การล้างข้อมูลเว็บไซต์อาจทำให้ไฟล์หาย ดาวน์โหลดไฟล์ไว้สำรองได้เสมอ ส่วนการอ่าน CV เพื่อเทียบ JD ยังไม่ได้เปิดใช้งาน</p>
    <Dialog open={!!deleting} onOpenChange={open => { if (!open && !busy) setDeleting(null); }} title="ลบ CV นี้?" description={`ลบ ${deleting?.name ?? ''} ออกจาก browser นี้ โดยไม่ลบไฟล์ต้นฉบับในเครื่อง`}>
      <div className="dialog-buttons">
        <Button variant="secondary" disabled={busy} onClick={() => setDeleting(null)}>ยกเลิก</Button>
        <Button variant="danger" disabled={busy} onClick={() => void remove()}>ยืนยันลบ CV</Button>
      </div>
    </Dialog>
  </section>;
}
