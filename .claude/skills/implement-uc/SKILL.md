---
name: implement-uc
description: Learn-by-building workflow for delivering one QueenKho Use Case (UC-xx) end to end — sync main, scan schema and code, settle business rules, plan for approval, hand over full reference code so the user types the backend, review, build the frontend, guide testing, check conflicts, prepare the PR. Use when the user assigns a new UC or says "làm UC-xx" / "implement UC-xx".
---

# Implement a UC (learn-by-building)

The user is a fullstack developer **learning Spring Boot through this project**. The goal is that the user **understands and can write the backend themselves**, not just that the code runs. Talk to the user in **Vietnamese**; keep code comments consistent with the codebase (`// UC-xx: ...`, Vietnamese is fine).

## Roles

| Work | Owner |
|---|---|
| Code scan, business questions, plan, full reference code | Claude |
| SQL + entire backend (Entity → Controller) | **User types it** from the reference code |
| Backend review | Claude |
| Frontend | Claude |
| Testing | User runs it, Claude writes the script |
| Push, open PR, merge | **User** (Claude never pushes or merges) |

**Fast-track mode:** when the user explicitly says "code luôn cho tôi" / "không kịp rồi" → Claude writes the backend (skip steps 6–7), but **still does steps 9–11** and points out the mistakes in whatever the user already wrote so they still learn.

---

## Step 1 — Sync with `main` before coding
- `git fetch origin`, then `git log --oneline HEAD..origin/main`.
- Remind the user to pull. If new commits touch `sql_script/` → remind them to **re-run the scripts on their local DB**.
- Note which files / statuses teammates' new commits touch (reused in step 10).

## Step 2 — Scan source code and SQL
- `sql_script/QueenKho.sql`: existing tables, columns, FKs, status comments. Flag tables that exist but have no Entity yet.
- Related existing code: controllers / services / repositories / pages for the same domain.
- **Find every place that changes the status** of the entities this UC uses: `grep -rn 'setStatus("' backend` plus `UPDATE ... SET status` inside JdbcTemplate calls. This is where fake logic and hidden conflicts live.
- Test data: does `setup_test_env.sql` have the accounts / roles this UC needs?

## Step 3 — Ask about the business rules until settled
- Ask **everything in one round**, grouped by topic: data source, who sees / who acts, statuses and transitions, deadlines, error cases, UI.
- **Every question comes with a proposed default** (marked "mình đề xuất") so the user can just say OK or change it.
- Actively **point out contradictions** in the requirements (e.g. "shared tasks" vs "claiming a task" needs an owner; "due the same day" vs the customer booking a different day).
- Repeat until nothing is ambiguous. Never assume business rules.

## Step 4 — Plan for approval (no code yet)
1. **Settled rules**: state diagram (ASCII) + table "event → what changes in which table".
2. **UI**: every screen, layout, **every button** and its behavior, loading / empty / error states.
3. **Backend**: new classes and modified existing classes, in order SQL → Entity → Repository → DTO → Service → Controller. Endpoints + error codes.
4. **Impact on existing code**: what must change and why.
5. **Defaults Claude chose**, so the user can push back.

Wait for approval before step 5.

## Step 5 — Hand over full reference code for the UC
- **SQL first**: the project uses `ddl-auto: validate` → a missing table or wrong column means the backend will not start. Wrap new tables in `IF OBJECT_ID('x','U') IS NULL` so the script can be re-run on an existing DB. Keep the `DELETE` order in `setup_test_env.sql` child-before-parent.
- New classes: complete code with comments explaining **why**, not just what; tag with `// UC-xx:`.
- Existing classes: **before / after** snippets with file + method named.
- Add a table **annotation → purpose → Maven dependency** for every annotation that is new to the user.
- Follow the conventions in `CLAUDE.md` (`XxxRequest/Response` DTOs, `{error, message}` errors, camelCase JSON, UPPERCASE statuses, normal imports).

## Step 6 — User types the code and asks questions
- The user types it (not copy-paste), one layer at a time. After **each layer**: `./mvnw -q compile`; after Entity / Repository also `./mvnw spring-boot:run` (Spring validates the schema and parses JPQL at startup).
- When answering questions: explain with **examples taken from this project's own source code**, using concrete data. When the user summarizes in their own words → confirm what is right and correct what is not.

## Step 7 — Review and fix
- **Read the real files in the repo** (don't wait for the user to paste). Run `mvnw compile` / `spring-boot:run` yourself to get the root error.
- Rank findings:
  - 🔴 Blocking (does not compile / does not start)
  - 🟠 Runs but breaks in use (`save()` fails, wrong data)
  - 🟡 Should fix (conventions, naming, readability)
- Each finding: **before → after → why**. Call out what the user did well.
- User fixes → review again until the app starts cleanly.

## Step 8 — Frontend (Claude builds it)
- `services/xxxService.js` (async functions returning `response.data`) → page / component → route in `App.jsx` → Layout menu.
- Reuse the existing Duo style (`duo-card`, `duo-badge`, `duo-input`, `duo-btn-*`, colors in `tailwind.config.js`).
- No dead links in menus. Add labels for any new status on **every page** that displays that status.
- `npx eslint <changed files>` + `npm run build`. Pre-existing lint errors in other files: report them, don't fix them in this UC.
- Verify in the browser with real test accounts (localhost) and check the console.
- Report to the user: endpoint, method, params/body, and which response fields the UI uses.

## Step 9 — Testing (user runs it, Claude guides)
Write a ready-to-run script for the user:
1. **API**: `curl` (or Postman) for the happy path **and** error paths (missing param, wrong status, calling twice).
2. **DB**: `SELECT` statements to run in SSMS to confirm the data changed correctly.
3. **Jobs / time**: how to simulate (e.g. `UPDATE ... SET due_at = DATEADD(minute,-1,SYSDATETIME())`, then wait for the job).
4. **UI**: which account to log in with, what to click, what should appear.
- Claude only modifies local DB data when necessary and **tells the user exactly what changed**. Validate DDL inside a transaction and roll back.

## Step 10 — Conflict check before pushing
1. `git fetch origin`, inspect `HEAD..origin/main` and the files both sides changed.
2. Dry-run the merge (`git merge-file -p` with base / ours / theirs) to see whether git will conflict.
3. **Business conflicts**: do teammates' new commits change statuses / data this UC depends on? (e.g. no-show cancels a contract while its check-in task stays open). If so → wire the logic together.
4. Create the UC branch (`feature/ucXX-...`), commit, `git pull --no-rebase origin main` into the branch, compile + retest.
5. Pre-existing bugs from other people found while testing → tell the user and spawn a separate task; don't fix them in this PR.

## Step 11 — Wrap up
- Update `docs/api-contract.md` for new endpoints / fields.
- Commit using the team rule `[dd/MM/yyyy][Name] Feature` (ask for the name if unknown). Ask which untracked files should be committed.
- Draft the **PR description**: summary, ⚠️ post-pull steps (run SQL, log in again...), table of business changes affecting other UCs, backend / frontend changes, test accounts, how to test, out of scope, notes for the team.
- The user runs `git push -u origin <branch>` and opens the PR. Remind them to `git switch main && git pull` after merge.
- Update memory: settled business rules + UC progress.

---

## Known pitfalls (use as a review checklist)
- Wrong / missing `s` in `@Table` → `missing table`. Missing `@Id` → `No identifier specified`.
- `GenerationType.AUTO` on SQL Server → looks for a sequence that does not exist; use `IDENTITY` for `IDENTITY` columns.
- `@JoinColumn` without `@ManyToOne` → `Could not determine recommended JdbcType`.
- `NOT NULL DEFAULT` columns: Hibernate sends an explicit `NULL` → the DB default is not applied. Use `insertable = false, updatable = false` for `created_at`; initialize statuses in Java.
- Boolean `isXxx` columns → drop `is` from the field name, keep `is_` in `@Column(name)`.
- `@Data` on entities → `toString/equals` touch LAZY relations. Use `@Getter @Setter`.
- JPQL string concatenation missing a trailing space; `:param` not matching `@Param`; misspelled derived-query keyword (`exitsBy`) → only surfaces at **startup**, compile still passes.
- `JOIN FETCH` on a nullable relation drops rows; use `LEFT JOIN FETCH`.
- `@Modifying` is required for UPDATE/DELETE queries and must run inside `@Transactional`.
- Concurrent claims → `UPDATE ... WHERE status = 'OPEN'` and check the affected row count; never read-then-write.
- IntelliJ shows `cannot find symbol` everywhere while `mvnw compile` passes → IDE cache: Rebuild Project / Reload Maven / enable annotation processing.
- `Application run failed` → find the last `Caused by` line or the `APPLICATION FAILED TO START` block.
- Frontend: no synchronous `setState` inside `useEffect` (rule `react-hooks/set-state-in-effect`) — set state in `.then()`.
- The frontend session is saved at login: adding fields to the login response means users must **log in again**.
