# E2E Sync Execution Plan

## Goal

Complete a full end-to-end sync of the application by domain, using the current UI as the operational source of truth while raising the overall product quality across:

- UI and UX consistency
- frontend validation and action feedback
- typed frontend/backend contracts
- backend rules, roles and business logic
- database persistence and schema support
- audit logging and structured operational logging
- realtime and connection behavior
- error handling and recovery

The objective is not to over-optimize a single bug or screen, but to move the entire product toward a coherent, complete, scalable SaaS baseline.

## Execution Rules

- Work domain by domain.
- For each domain, review and sync: `ui -> validation -> frontend calls -> backend controller -> backend service -> db -> audit/log -> rules/roles -> response -> retrieve/update flow -> error handling -> realtime feedback`.
- Every user action must have a visible feedback state: pending, success, error.
- Every write action must be logged.
- Every protected action must be checked by role and domain rule.
- Prefer shared typed contracts over local `any` payloads.
- Avoid getting stuck on a single module; deliver steady progress across priorities.

## Priority Order

### Phase 0 - Cross-domain foundation

1. Standardize API error shape and frontend error mapping.
2. Introduce a global UI feedback system for success/error/loading action states.
3. Introduce consistent audit logging conventions for all write actions.
4. Improve connection handling for auth refresh, realtime feed and recoverable failures.
5. Reduce untyped contracts in shared API surfaces.

### Phase 1 - Core identity and access

1. Auth
2. Users / profile / onboarding
3. Teams and membership requests

### Phase 2 - Operational scheduling flows

1. Availability
2. Duties
3. Events and assignments
4. Replacements
5. Scheduling automation

### Phase 3 - Incomplete support domains

1. Inventory
2. Resources / file manager
3. Notifications and logging surfaces
4. AI settings

### Phase 4 - Final consistency pass

1. Role-by-role flow verification
2. UI and UX coherence pass
3. Cross-domain regression pass
4. Documentation refresh

## Domain Checklist

Use this checklist for every domain before moving on.

### 1. UI and UX

- Verify screen purpose and remove random or weakly-connected actions.
- Make action hierarchy clear.
- Add empty, loading, success and error states.
- Ensure consistent labels, wording and visual feedback.

### 2. Frontend validation and calls

- Validate required fields before submit.
- Align FE payloads to shared contracts.
- Remove `any` where domain types exist.
- Ensure each action refreshes or updates local state correctly.

### 3. Backend flow

- Verify controller routes match UI expectations.
- Verify DTO validation and normalized response shape.
- Verify service logic covers create, retrieve, update, delete or resolve paths.
- Reuse shared rule checks instead of duplicating logic.

### 4. Data and persistence

- Ensure Prisma schema supports the UI flow.
- Add missing relations or fields only when required by the domain.
- Ensure read models and write models reflect the same business truth.

### 5. Roles, rules and audit

- Check authentication.
- Check role authorization.
- Check domain ownership/scope rules.
- Log every write action and relevant operational failure.

### 6. Feedback and resilience

- Return actionable error messages.
- Surface success/error messages in the UI.
- Support retry or recovery when reasonable.
- Keep realtime updates aligned with saved state.

## Detailed Delivery Backlog

### A. Cross-domain foundation

- Add shared `ApiError` and `ActionFeedback` contracts.
- Add NestJS global exception filter returning a normalized error payload.
- Add frontend feedback store/service and shell-level toast center.
- Add a reusable frontend helper for action execution with success/error feedback.
- Add structured request/action logging baseline.
- Normalize websocket event payloads.

### B. Auth

- Rework auth screen so login and registration flows are intentional and validated.
- Add better pending/success/error feedback.
- Audit login success/failure, signup request creation, approval, decline, password reset and verification flows.
- Fix team selection flow for public registration.
- Normalize refresh-token and expired-session behavior.

### C. Users / onboarding

- Split onboarding into real progression steps instead of forced completion.
- Align `User` and `UserSettings` persistence to onboarding UX.
- Ensure profile updates log changes and return typed responses.

### D. Teams

- Separate signup approval from team-join invitation flows in the UI and backend.
- Add clearer membership, pending request and approval states.
- Audit create/update/member add/member remove/request resolution flows.

### E. Availability

- Strengthen time validation and overlap rules.
- Ensure leaders only operate within allowed scope.
- Add visible action feedback and consistent responses.

### F. Duties

- Align CRUD behavior and ownership rules.
- Ensure downstream usage in events remains consistent.

### G. Events / assignments

- Treat event editing as a full domain flow, not only title/date patching.
- Keep slot, assignment and response models coherent.
- Reuse assignment rules everywhere.
- Add richer feedback and audit coverage.

### H. Replacements

- Reuse assignment validation when approving replacement assignees.
- Align notifications, audit and UI status changes.

### I. Scheduling

- Enforce team scope even in broader preview flows.
- Return explainable result states.
- Log preview/apply decisions and publish coherent realtime events.

### J. Inventory

- Complete backend CRUD to match the current UI.
- Add team-aware validation and audit.
- Return full typed list and item responses.

### K. Resources

- Implement upload, rename, delete, download and list as a real domain.
- Default storage strategy: local filesystem storage with DB metadata, designed so storage can be abstracted later.
- Enforce team scope and add upload/download feedback.

### L. Notifications / logging

- Add read or acknowledge flow for notifications.
- Expand logging beyond health stub into queryable operational surfaces.
- Align websocket feed events to actionable UI items.

### M. AI settings

- Persist settings instead of returning env-only snapshots.
- Support save, ping, models retrieval and automation-related settings with clear validation.
- Audit changes and return typed responses.

## Completion Criteria

The plan is complete when:

- all major domains match the current UI flow,
- each action has feedback,
- each protected action enforces roles and rules,
- each write action is audited,
- backend and DB support the UI flows without placeholder gaps,
- cross-domain UX feels coherent rather than assembled piecemeal.

## Progress Tracking

- [x] Phase 0 - Cross-domain foundation
- [x] Phase 1 - Core identity and access
- [x] Phase 2 - Operational scheduling flows
- [x] Phase 3 - Incomplete support domains
- [x] Phase 4 - Final consistency pass
