# CareerOS implementation plan

วันที่เริ่ม: 21 ตุลาคม 2026 · Source: PRODUCT_REQUIREMENTS.md v1.0

## เป้าหมายและสมมติฐาน

สร้าง responsive personal career workspace สำหรับ Tech roles ก่อน รองรับการขยายเป็น SaaS โดยใช้ modular monolith: Next.js App Router / TypeScript / Tailwind, Supabase Auth + Postgres/RLS และ background worker เมื่อเปิด AI จริง สมัครงานที่เว็บต้นทางและให้ผู้ใช้ยืนยันสถานะเองเสมอ

PRD เป็น product specification ไม่ใช่คำสั่งให้เปิดบัญชี ส่งข้อความ จ่ายเงิน หรือ deploy ภายนอก การเริ่มงานครั้งนี้ครอบคลุม implementation ภายใน repository และการตรวจสอบในเครื่อง

รอบแรกส่งมอบ local prototype ที่ใช้งาน flow หลักได้โดยไม่ต้องมี credentials เก็บข้อมูลใน browser พร้อมป้ายบอกโหมดชัดเจน ไม่ถือเป็น production authentication หรือ multi-user isolation และไม่แอบส่งข้อมูลไป AI / job boards

## ลำดับงานและ acceptance gates

| Task | งานที่จะทำ | เกณฑ์ผ่าน | สถานะ |
|---|---|---|---|
| ENG-01 | Next.js, TS, Tailwind, lint, Vitest, Playwright, CI | lint / typecheck / unit / build ผ่าน | Complete (local prototype) |
| ENG-04 | Shell, tokens, responsive navigation, forms, dialogs | keyboard ใช้ได้, 390px ไม่ตัด primary actions | Complete (local prototype) |
| ENG-02 | Supabase passwordless auth, session, protected routes | login/logout; cross-user E2E denied | Planned: requires configured Supabase |
| ENG-03 | Versioned migration + owner constraints/RLS | migrations + two-user DB tests pass | Migration + ownership test script written; Supabase execution pending |
| ENG-05 | Source policy registry + connector boundary | unknown and restricted sources link-only; no URL fetching | Complete (local prototype) |
| ENG-06/07 | Manual import, URL dedup, provenance, inbox/detail | import → search → save → reload; duplicate retains origin | Complete (local mode) |
| ENG-08/09 | Evidence-based skill extraction, editable priority, advisory matching | exact quote/span, weights/gaps inspectable, no hiring probability | Deterministic baseline complete and tested; LLM deferred |
| ENG-10/11 | Gap-based daily tasks, capacity, completion, reschedule | total minutes ≤ available/day; evidence retained | Complete (local mode) |
| ENG-12 | Application board/table + manual transitions + events | no auto-applied on external click; history retained | Complete (local mode) |
| ENG-13 | Local export/reset; later account deletion + storage purge | own data downloadable; confirmed local deletion | Local export/reset complete and tested; account flow deferred |
| ENG-14 | Unit + browser QA, mobile + production build | automated tests pass; pilot remains explicit pending gate | Local automated QA passed; production audit and pilot pending |
| ENG-15/16 | Portfolio/approved feeds | after P0, documented permission per connector | Deferred P1 |

## Implementation slices

1. **Foundation** — application layout, dependencies, scripts, typed domain model, validated storage, design tokens, navigation, honest local-mode notice, empty states.
2. **Jobs and profile** — preferences/skills, manual role/company/URL, consent gate for owned/permitted JD, policy rejection for restricted sources, canonical URL dedup, searchable list and source details.
3. **Analysis and learning** — versioned rule parser (Thai/English priority cues), preserved evidence spans, user corrections, deterministic weighted coverage and unknowns, daily task generation limited by capacity, completion proof and date changes.
4. **Applications and privacy** — board/table, notes, explicit status confirmation, event timestamps, follow-up dates, local export/reset, theme.
5. **Production foundation** — Supabase SQL migration with owner RLS and foreign-key owner constraints; CI; environment template; document unimplemented production boundaries.
6. **Verify** — policy/dedup/evidence/matching/capacity unit tests; browser flow import → analyze → learning → application → reload/export; 390px layout; lint/typecheck/build.

## Production integration work after local prototype

- Connect Supabase through server-side verified sessions; never accept user_id from request bodies. Replace browser persistence with repository implementations backed by RLS; no service-role key in browser.
- Run migrations in a dedicated dev instance and verify two-user insert/read/update/delete and child reparenting denial. These gates must pass before calling ENG-02/03 complete.
- Add Google OAuth/magic links, onboarding route, private storage, consent records, retention rules and transactional account deletion/export.
- Add LLM provider adapter with Zod, explicit provider-processing consent, model/prompt versions, async queue (Inngest), idempotency, quotas, bounded retries and evaluation fixtures. Rule baseline is not described as AI.
- Add opt-in notification delivery, timezone/quiet hours, dedupe and reminder worker. Follow-up dates in local prototype are records, not scheduled delivery.
- Complete TH/EN localization, server persistence, production accessibility/performance/security audit and 10–20 person pilot.
- PWA offline cache needs an explicit private-data policy; defer service worker caching until privacy review.

## Risks / decisions

- Job board rights are not assumed from PRD reference dates. All connectors default to link-only. No scraper, partner API or legal compliance claim is implemented.
- Local storage is same-browser data, not encrypted storage, cross-device sync or account isolation. Avoid storing CVs/secrets here.
- Parser baseline can miss skills and priority cues; human review is required. Score measures declared skill coverage only.
- No fabricated jobs, salaries, dates, learning-resource verification or application submissions. Demo data, if loaded, must be labeled synthetic.
- Credentials, deployment target, AI budget, provider retention and source licenses remain production decisions; they do not block local implementation.

## References

- https://nextjs.org/docs/app/getting-started/installation
- https://supabase.com/docs/guides/database/postgres/row-level-security
- Original PRD acceptance criteria AC-01 through AC-10; local prototype does not satisfy signed-in AC-01, AC-07 or production AC-10.


## Progress — 21 October 2026

Local implementation slices 1–6 are complete within the prototype scope. Added responsive
styles and themes, fixed parser aliases (`Next.js` no longer implies JavaScript), added
section-heading priority and exact clause evidence, validated stored URLs/dates, retained
original applied timestamps and handled import/export/storage failures.

Validation performed on the local production build:

- `npm run lint` — passed.
- `npm run typecheck` — passed.
- `npm test` — 23 passed.
- `npm run build` — passed with the supported Webpack builder.
- `npm run test:e2e` — 10 passed across desktop Chromium and a 390px mobile Chromium viewport.
- Browser checks cover import, policy restrictions, duplicates, evidence, capacity rejection,
  rescheduling, proof/completion, explicit Applied confirmation, reload, exported JSON contents,
  confirmed reset, corrupt storage preservation, quota failures, layout and Escape dismissal.
- Reviewed generated desktop dashboard and mobile settings/application screenshots.

Turbopack failed while binding an internal port in the managed environment, including after
an escalation attempt. The build script uses `next build --webpack`; this is a successful
production build, not a skipped build check. CI configuration is written but has not run on
GitHub (the supplied workspace has no Git repository metadata).

Database foundation: `supabase/migrations/202610210001_workspace.sql` includes owner RLS and
composite owner foreign keys. `supabase/tests/ownership.sql` tests two-user mutations and
child reparenting and rolls fixtures back. Neither has been run against a configured
Supabase instance; ENG-02/03 and AC-07 remain pending. The UI still uses browser storage.

Next production slice requires a configured Supabase dev instance: run migration and
ownership tests, implement verified server sessions and repository adapters, then replace
local persistence. AI consent/provider integration, private files, notifications, full
localization, production account deletion and the 10–20 person pilot remain outstanding.
