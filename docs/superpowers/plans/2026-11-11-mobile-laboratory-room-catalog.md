# Mobile Laboratory Room Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ปรับหน้า `/keys` บน Mobile ให้ใกล้เคียง Figma frame `915:1619` โดยแสดงข้อมูลห้อง สถานะ ช่วงเวลาว่าง และตารางใช้งานจากระบบเดิม

**Architecture:** คง flow `page → TanStack Query → existing service/Supabase RPC` และ route/auth logic เดิม ปรับเฉพาะ semantic markup ของ page/card และเพิ่ม CSS แบบ mobile-scoped ใน feature เพื่อไม่ให้ Desktop หรือหน้าอื่นเปลี่ยนแปลง ใช้ `PublicLayout` และ Mobile Header ที่มีอยู่แล้วโดยไม่สร้าง navigation ซ้ำ

**Tech Stack:** React 19, TypeScript, Vite, React Router, TanStack Query, CSS, Vitest, React Testing Library

**Spec:** คำขอผู้ใช้ในบทสนทนานี้ และ Figma frame `https://www.figma.com/design/QZ6ZwIoyRRhixBGR0tqoVh/ITD336?node-id=915-1619&m=dev`

## Global Constraints

- อ่านและเทียบเฉพาะ Figma node `915:1619`; ไม่อ่าน page/frame อื่น
- ใช้ข้อมูลจริงจาก query/service เดิม; ห้าม hardcode S2407–S2412 หรือเวลาตัวอย่างจาก Figma
- ห้ามแก้ Backend, Database, Supabase Functions, API หรือ Business Rules
- คง Navigation, Authentication, availability calculation และ booking/key-request flow เดิม
- UI ใหม่ต้องมีผลเฉพาะ Mobile (`max-width: 480px`); Desktop และหน้าอื่นต้องคงเดิม
- Reuse `PublicLayout`, `KeyRoomCatalogCard`, `LoadingSpinner`, `GoogleSsoModal`, query keys และ asset โลโก้เดิม
- ห้าม commit, push หรือ deploy แม้ขั้นตอนทั่วไปของ workflow จะเสนอให้ commit
- รักษา user changes ที่ค้างอยู่ใน worktree และตรวจ diff เฉพาะไฟล์ในแผน

## Review Focus

- ห้อง inactive ต้องแสดงสถานะไม่พร้อมใช้และปุ่ม action disabled โดยไม่ทำให้ link/detail ของห้องอื่นเสีย
- ห้อง active แต่ไม่มีช่วงว่างต้องแสดง empty state และห้ามเริ่ม request flow
- Loading/error/empty category ต้องอ่านได้และ retry ได้เหมือนเดิม
- Tab ห้องทั่วไป/ห้องพิเศษต้องกรองจาก `requiresSsoForKeyRequest` และคง ARIA tab semantics
- ชื่อ event/room และช่วงเวลาที่ยาวต้องไม่ล้นการ์ดที่ viewport 320–440px

---

### Task 1: Lock existing behavior with targeted tests

**Files:**
- Modify: `src/App.test.tsx`
- Test: `src/App.test.tsx`

**Interfaces:**
- Consumes: route `/keys`, mocked Supabase RPC responses, existing accessible names
- Produces: regression coverage for tabs, real room data, status states, schedule rows, detail link, request action, and authentication modal

- [ ] **Step 1: Add failing mobile catalog behavior tests**
  - Assert heading and description match the approved copy without using Figma sample room data.
  - Assert both tabs retain `role="tab"` and `aria-selected` behavior.
  - Assert a room returned by the catalog RPC renders its real code and current availability label.
  - Assert schedule events returned by the existing public schedule query render their real title/time.
  - Assert inactive and fully occupied rooms expose disabled request actions.
  - Assert detail and request links keep their current destinations.

- [ ] **Step 2: Run the targeted tests and confirm the new assertions fail for the intended UI gaps**
  - Run: `npm run test -- src/App.test.tsx`
  - Expected: existing tests remain green; new markup/content assertions fail before implementation.

### Task 2: Refine page structure without changing data flow

**Files:**
- Modify: `src/features/keys/pages/KeyRequestRoomsPage.tsx`
- Create: `src/features/keys/components/KeyRoomCatalog.css`

**Interfaces:**
- Consumes: `publicRoomsQuery()`, `AuthIdentity`, `KeyRoomCatalogCard`
- Produces: `.key-room-catalog-page`, `.key-room-catalog-intro`, `.key-room-tabs`, and `.key-room-list` structure scoped to this screen

- [ ] **Step 1: Import the feature-local stylesheet from `KeyRequestRoomsPage.tsx`**

- [ ] **Step 2: Add catalog-specific class names and semantic wrappers**
  - Keep the current loading, error/retry, empty-category and tab state logic unchanged.
  - Preserve exact filtering: `usageScope === 'LABORATORY'` and `Boolean(requiresSsoForKeyRequest) === special`.
  - Use title/description layout from Figma while keeping copy aligned with the existing key-request flow.

- [ ] **Step 3: Add mobile-only page and tab styles**
  - At `max-width: 480px`, implement 16px page gutters, Figma-aligned typography, two equal tabs, active underline, 16px card gap and white background.
  - Do not override desktop layout outside the media query.

- [ ] **Step 4: Run the page-level targeted tests**
  - Run: `npm run test -- src/App.test.tsx`
  - Expected: heading, tabs, loading/error/empty and filtering assertions pass.

### Task 3: Match room cards to Figma using real system data

**Files:**
- Modify: `src/features/keys/components/KeyRoomCatalogCard.tsx`
- Modify: `src/features/keys/components/KeyRoomCatalog.css`
- Modify only if a presentation helper is needed: `src/features/keys/utils/key-catalog-time.ts`
- Test only if helper changes: `src/features/keys/utils/key-catalog-time.test.ts`
- Test: `src/App.test.tsx`
- Add during implementation only when no exact local match exists: `src/assets/key-room.svg`, `src/assets/external-link.svg`

**Interfaces:**
- Consumes: `ScheduleRoom`, `AuthIdentity`, `publicScheduleEventsQuery`, `publicKeyRequestHistoryQuery`, `freeRangesForBangkokDay`, existing routes
- Produces: responsive card sections for room identity, availability badge, free-time chips, usage rows, detail link and request CTA

- [ ] **Step 1: Verify existing assets before adding anything**
  - Reuse the current IT KeySpace logo and any matching local icons.
  - If no exact key/external-link icon exists, download only the corresponding visible vector assets from Figma node `915:1619` into `src/assets/`; never keep temporary Figma URLs in runtime code.

- [ ] **Step 2: Refactor card markup into named visual sections without changing query or navigation behavior**
  - Room code/name/building/floor remain derived from `room`.
  - Status remains derived from `room.active` and calculated `available` ranges.
  - Free-time chips remain derived from `freeRangesForBangkokDay(events.data, date)`.
  - Usage rows use the existing public schedule/history results; no Figma names or times are copied into code.
  - Preserve the current detail route, request route, anonymous flow, SSO modal behavior and disabled conditions.

- [ ] **Step 3: Implement mobile card styling in `KeyRoomCatalog.css`**
  - Match the 8px radius, light border/shadow, 12px padding, 16px internal rhythm, green/red/gray badges, compact time chips, blue-tinted schedule rows, right-aligned detail link and navy-to-yellow CTA.
  - Use wrapping/truncation rules for long real data and keep controls at accessible touch sizes.
  - Scope all visual overrides beneath `.key-room-catalog-page` and the mobile media query.

- [ ] **Step 4: Verify static assets and responsive geometry**
  - Confirm each new asset exists locally, is non-empty, is used at the correct callsite, and retains its designed aspect ratio.
  - Inspect widths at 320px, 375px and 440px; no horizontal overflow.

- [ ] **Step 5: Run targeted tests**
  - Run: `npm run test -- src/App.test.tsx src/features/keys/utils/key-catalog-time.test.ts`
  - Expected: tabs, status variants, real event/time rendering, detail/request actions and auth modal tests pass.

### Task 4: Integrate the existing Mobile Header and verify scope

**Files:**
- Review first; modify only if the Figma comparison proves necessary: `src/features/public/components/KeyHeader.css`
- Review only unless semantic wiring is missing: `src/features/public/components/PublicLayout.tsx`
- Test: `src/App.test.tsx`

**Interfaces:**
- Consumes: existing `NotificationBell`, `AccountIdentitySummary`, IT KeySpace logo and user-menu behavior
- Produces: no new navigation/auth interface; only mobile-scoped visual alignment if required

- [ ] **Step 1: Compare the rendered existing header with node `915:1906`**
  - Reuse the header work already present in the dirty worktree.
  - Do not overwrite unrelated/user-authored header changes.

- [ ] **Step 2: Apply only proven mobile visual deltas**
  - Limit changes to size, spacing, border and logo geometry.
  - Do not change notification, account menu, authentication or route logic.

- [ ] **Step 3: Run header/catalog integration tests**
  - Run: `npm run test -- src/App.test.tsx`
  - Expected: header controls and all catalog flows pass.

### Task 5: Final verification and evidence-based report

**Files:**
- Review: all files modified by Tasks 1–4

- [ ] **Step 1: Run required checks**
  - `npm run test -- src/App.test.tsx src/features/keys/utils/key-catalog-time.test.ts`
  - `npm run typecheck`
  - `npm run build`

- [ ] **Step 2: Run repository hygiene checks**
  - `git diff --check`
  - `git status --short`
  - Review only the scoped diffs; do not display a full diff or long logs.

- [ ] **Step 3: Perform visual comparison of `/keys` against Figma**
  - Check only the requested Mobile screen at 320px, 375px and 440px.
  - Verify header, intro, tabs, all room states, time chips, schedule rows, actions, assets, overflow and vertical rhythm.
  - Record any environment limitation if authenticated or browser rendering cannot be executed.

- [ ] **Step 4: Report in concise Thai**
  - Files changed.
  - UI sections completed.
  - Commands and pass/fail results.
  - Remaining Figma mismatches or verification limitations.
  - Explicitly state that Backend/Database/API were untouched and no commit/push/deploy occurred.

