'use client';
export default function Error({reset}:{reset:()=>void}){return <main className="error-screen"><h1>เปิด workspace ไม่สำเร็จ</h1><p>ข้อมูลใน browser ยังไม่ถูกลบ ลองโหลดอีกครั้ง</p><button onClick={reset}>ลองอีกครั้ง</button></main>;}
