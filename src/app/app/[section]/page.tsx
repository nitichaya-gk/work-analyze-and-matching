import { notFound } from 'next/navigation';
import { WorkspaceApp } from '@/components/workspace-app';
const sections=['dashboard','jobs','analysis','skills','learning','applications','settings'];
export function generateStaticParams(){return sections.map(section=>({section}));}
export default async function Page({params}:{params:Promise<{section:string}>}) {const {section}=await params;if(!sections.includes(section))notFound();return <WorkspaceApp section={section}/>;}
