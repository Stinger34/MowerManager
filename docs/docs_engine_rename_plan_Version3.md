# Engine Rename & Component Deprecation Plan

## Summary
The legacy “Component” terminology is being replaced by **Engine** across the application. The backend and schema are already canonicalized to engines. The `/api/components*` endpoints now emit deprecation headers and will be removed after the Sunset date.

## Deprecation Headers (Active)
| Header | Value |
|--------|-------|
| `Deprecation` | `true` |
| `Sunset` | `2025-12-31` |
| `Link` | `</api/engines>; rel="successor-version"` |
| `X-Deprecated-Endpoint` | `/api/components` |

Update the Sunset date as needed to fit your release cadence.

## Migration Phases
| Phase | Action | Status |
|-------|--------|--------|
| 1 | Add deprecation headers + publish plan | Complete |
| 2 | Frontend rename (queries, files, types) | Pending |
| 3 | Switch `/api/components*` responses to HTTP 410 Gone | Pending |
| 4 | Remove compatibility routes | Pending |

## Required Frontend Changes
1. Rename files:  
   - `ComponentForm*` → `EngineForm*`  
   - `ComponentDetails` → `EngineDetails`  
   - `AllocateComponentModal` → `AllocateEngineModal`  
   - `AddComponent` → `AddEngine`  
2. Replace API paths:  
   - `/api/components` → `/api/engines`  
   - `/api/mowers/:id/components` → `/api/mowers/:id/engines`  
   - `/api/components/:id/attachments` → `/api/engines/:id/attachments`  
   - `/api/components/:id/parts` → `/api/engines/:id/parts`  
3. Rename identifiers: `component`, `components`, `componentId` → `engine`, `engines`, `engineId`.  
4. Asset part allocation forms & DTOs: use `engineId` exclusively.  
5. Remove WebSocket listeners for `component-created|updated|deleted`. Use `engine-*` only.  
6. Remove any type aliases for `Component`; rely on `Engine`, `InsertEngine`.  
7. Update UI text (labels, headings, toasts, documentation).  

## Backend Follow-Up
| Step | Description |
|------|-------------|
| 410 Transition | After frontend migration, return HTTP 410 for `/api/components*` for one release |
| Removal | Delete compatibility block & helper function |
| Docs | Remove references to “component” alias |
| Monitoring | Stop tracking deprecated endpoint metrics once usage is zero |

## Risk Mitigation
| Risk | Mitigation |
|------|------------|
| Missed imports | Grep for `component` after refactor |
| Dual query caches | Add assertion test: no queries with `/api/components` |
| Stale WebSocket handlers | Remove old `component-*` cases first |
| DTO mismatch (`componentId`) | TypeScript compile will fail once alias removed |
| Metrics confusion | Tag logs with `X-Deprecated-Endpoint` header |

## Verification Checklist
- [ ] No network calls to `/api/components`
- [ ] No occurrences of `componentId` in new code (except migration scripts)
- [ ] WebSocket invalidation works with `engine-*` only
- [ ] Parts allocation correctly associates `engineId`
- [ ] UI strings show “Engine” consistently
- [ ] Tests (if present) updated
- [ ] CHANGELOG updated

## Proposed CHANGELOG Entry
```
Refactor: Deprecated /api/components in favor of /api/engines. Added headers (Deprecation, Sunset, Link) and published migration plan. Frontend should migrate before 2025-12-31.
```

## Example Cutover Timeline
| Release | Action |
|---------|--------|
| N | Deprecation headers added |
| N+1 | Frontend migrated |
| N+2 | `/api/components` → HTTP 410 |
| N+3 | Remove compatibility code |

## Optional Enhancements
- Centralize allocation logic in `engineAllocationService` and `partAllocationService`.
- Consolidate attachment handling into a single attachment service (reduce duplication).
- Introduce `EngineState` enum for lifecycle (Active, Maintenance, Retired).
- Add telemetry for engine allocation frequency and part usage patterns.

## Post-Migration Removal Procedure
1. Confirm zero calls to `/api/components`.
2. Switch to HTTP 410 for one minor release (if desired).
3. Remove code & headers.
4. Update docs, README, and any architectural diagrams.

## Quick Grep Targets
```
grep -R \"componentId\" client/
grep -R \"/api/components\" client/
grep -R \"ComponentDetails\" client/
```

## Final Note
Keep the compatibility layer only as long as necessary; prolonged dual semantics increase cognitive load and the risk of regressions. Tighten the migration window if usage is already low.
