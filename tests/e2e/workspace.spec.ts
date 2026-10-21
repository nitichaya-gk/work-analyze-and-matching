import { test, expect } from '@playwright/test';

test('import → evidence → learning → confirmed application → reload → export → reset', async ({ page }) => {
  await page.goto('/app/jobs');
  await page.getByRole('button', { name: 'เพิ่มงาน', exact: true }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('ลิงก์ประกาศงาน').fill('https://example.com/test-role');
  await dialog.getByLabel('ชื่อตำแหน่ง', { exact: true }).fill('Frontend Developer');
  await dialog.getByLabel('บริษัท', { exact: true }).fill('Synthetic test company');
  await dialog.getByLabel('JD ที่คุณมีสิทธิ์ใช้งาน').fill('Must have TypeScript and React\nNice to have Docker');
  await dialog.getByRole('checkbox').check();
  await dialog.getByRole('button', { name: 'บันทึกงาน', exact: true }).click();
  await page.getByRole('button', { name: /Frontend Developer/ }).click();
  await dialog.getByRole('button', { name: 'วิเคราะห์ JD' }).click();
  await expect(dialog.getByText('Must have TypeScript and React', { exact: true }).first()).toBeVisible();
  await expect(dialog.getByLabel('ความสำคัญ TypeScript')).toHaveValue('must_have');
  await dialog.getByRole('button', { name: 'เตรียมสมัคร' }).click();
  await dialog.getByRole('button', { name: 'ปิด', exact: true }).click();
  await page.goto('/app/learning');
  await page.getByRole('button', { name: 'สร้างแผนจาก skill gaps' }).click();
  await expect(page.getByText('ฝึก TypeScript กับงานเป้าหมาย', { exact: true })).toBeVisible();
  const dateInput=page.getByLabel('เลื่อน TypeScript', { exact: true });
  const originalDate=await dateInput.inputValue();
  await dateInput.fill(await page.getByLabel('เลื่อน React', { exact: true }).inputValue());
  await expect(dateInput).toHaveValue(originalDate);
  await expect(page.getByRole('status')).toContainText('เกิน capacity');
  const freeDay=new Date(`${originalDate}T12:00:00Z`);
  freeDay.setUTCDate(freeDay.getUTCDate()+7);
  await dateInput.fill(freeDay.toISOString().slice(0,10));
  const proof = page.getByLabel('ลิงก์หลักฐาน (ไม่บังคับ)').first();
  await proof.fill('https://example.com/learning-proof');
  await proof.press('Tab');
  await page.getByRole('button', { name: 'ทำเสร็จ ฝึก TypeScript กับงานเป้าหมาย', exact: true }).click();
  await expect(page.getByText('1 completed', { exact: true })).toBeVisible();
  await page.goto('/app/applications');
  await page.getByLabel('สถานะ Frontend Developer').selectOption('applied');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'ยกเลิก', exact: true }).click();
  await expect(page.getByLabel('สถานะ Frontend Developer')).toHaveValue('preparing');
  await page.getByLabel('สถานะ Frontend Developer').selectOption('applied');
  await page.getByRole('button', { name: 'ยืนยัน ส่งใบสมัครแล้ว', exact: true }).click();
  await page.reload();
  await expect(page.getByLabel('สถานะ Frontend Developer')).toHaveValue('applied');
  await page.screenshot({ path: `test-results/applications-${test.info().project.name}.png`, fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto('/app/settings');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'ส่งออกข้อมูล JSON' }).click();
  const file=await download;
  expect(file.suggestedFilename()).toMatch(/^careeros-.*\.json$/);
  const stream=await file.createReadStream();
  if(!stream) throw new Error('Export stream unavailable');
  const chunks=[];
  for await (const chunk of stream) chunks.push(chunk);
  const exported=JSON.parse(Buffer.concat(chunks).toString());
  expect(exported.jobs).toHaveLength(1);
  expect(exported.applications[0].status).toBe('applied');
  expect(exported.tasks[0]).toMatchObject({ done: true, proof: 'https://example.com/learning-proof' });
  await page.getByRole('button', { name: 'ลบข้อมูลในเครื่อง', exact: true }).click();
  await expect(page.getByRole('button', { name: 'ยืนยันลบข้อมูล' })).toBeDisabled();
  await page.getByLabel('คำยืนยัน').fill('DELETE');
  await page.getByRole('button', { name: 'ยืนยันลบข้อมูล' }).click();
  await page.reload();
  expect(await page.evaluate(() => localStorage.getItem('careeros.workspace.v1'))).toBeNull();
});

test('restricted sources hide JD and duplicate import stays open', async ({ page }) => {
  await page.goto('/app/jobs');
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.getByRole('button', { name: 'เพิ่มงาน', exact: true }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('ลิงก์ประกาศงาน').fill('https://www.linkedin.com/jobs/view/123?utm_source=test');
    await expect(dialog.getByLabel('JD ที่คุณมีสิทธิ์ใช้งาน')).toHaveCount(0);
    await dialog.getByLabel('ชื่อตำแหน่ง', { exact: true }).fill('Restricted role');
    await dialog.getByLabel('บริษัท', { exact: true }).fill('Synthetic test company');
    await dialog.getByRole('button', { name: 'บันทึกงาน', exact: true }).click();
    if (attempt) await expect(dialog.getByRole('alert')).toContainText('บันทึกลิงก์งานนี้แล้ว');
  }
});

test('corrupt storage is preserved and edits stay blocked', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('careeros.workspace.v1', '{broken'));
  await page.goto('/app/settings');
  await expect(page.getByRole('alert').filter({ hasText: 'อ่านข้อมูลเดิมไม่สำเร็จ' })).toBeVisible();
  await page.getByRole('button', { name: 'เพิ่มงาน', exact: true }).first().click();
  const dialog=page.getByRole('dialog');
  await dialog.getByLabel('ชื่อตำแหน่ง', { exact: true }).fill('Blocked write');
  await dialog.getByLabel('บริษัท', { exact: true }).fill('Synthetic fixture');
  await dialog.getByRole('button', { name: 'บันทึกงาน', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('บันทึกไม่สำเร็จ');
  expect(await page.evaluate(() => localStorage.getItem('careeros.workspace.v1'))).toBe('{broken');
});

test('navigation fits viewport and import dialog supports Escape', async ({ page }) => {
  for (const section of ['dashboard', 'jobs', 'skills', 'analysis', 'learning', 'applications', 'settings']) {
    await page.goto(`/app/${section}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if(section==='dashboard') await page.screenshot({ path: `test-results/dashboard-${test.info().project.name}.png`, fullPage: true });
  }
  await page.getByRole('button', { name: 'เพิ่มงาน', exact: true }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.screenshot({ path: `test-results/settings-${test.info().project.name}.png`, fullPage: true });
});

test('storage write failure keeps import open and does not claim success', async ({ page }) => {
  await page.addInitScript(() => {
    const original=Storage.prototype.setItem;
    Storage.prototype.setItem=function(key:string, value:string) {
      if(key==='careeros.workspace.v1') throw new DOMException('Quota exceeded', 'QuotaExceededError');
      return original.call(this,key,value);
    };
  });
  await page.goto('/app/jobs');
  await page.getByRole('button', { name: 'เพิ่มงาน', exact: true }).first().click();
  const dialog=page.getByRole('dialog');
  await dialog.getByLabel('ชื่อตำแหน่ง', { exact: true }).fill('Unsaved role');
  await dialog.getByLabel('บริษัท', { exact: true }).fill('Synthetic fixture');
  await dialog.getByRole('button', { name: 'บันทึกงาน', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('บันทึกไม่สำเร็จ');
  expect(await page.evaluate(() => localStorage.getItem('careeros.workspace.v1'))).toBeNull();
});
