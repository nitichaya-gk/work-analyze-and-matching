import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'CareerOS — Your next chapter',description:'พื้นที่ส่วนตัวสำหรับจัดการงานเป้าหมาย เติมทักษะ และติดตามใบสมัคร'};
export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="th"><body>{children}</body></html>;}
