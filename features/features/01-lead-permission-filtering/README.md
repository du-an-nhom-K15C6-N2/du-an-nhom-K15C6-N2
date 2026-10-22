# Lead access by advisor

NestJS + TypeORM example implementing role authorization and query-level lead filtering.

## Assumptions

- A configured Passport JWT strategy authenticates the request and sets `request.user` to `{ id, role }`.
- `role` is one of `ACADEMIC_ADVISOR` or `TRAINING_MANAGER`.
- The lead table has a nullable UUID column named `assigned_to`.
- NestJS, `@nestjs/passport`, `@nestjs/typeorm`, TypeORM, and a configured TypeORM connection are provided by the host application.

Register `LeadsModule` in the application and ensure the existing JWT strategy is registered. Extend `Lead` with the application's other lead columns as needed.

## Behavior

- Missing or invalid JWT authentication is rejected by `JwtAuthGuard` with HTTP 401. `RolesGuard` also returns 401 if the authenticated principal is missing or has no user ID.
- An authenticated role other than advisor or training manager is rejected with HTTP 403.
- Advisors query only rows where `assigned_to` matches their authenticated user ID.
- Training managers query all lead rows; the repository adds no assignment filter.

The controller cannot supply an arbitrary user ID for filtering. The repository takes the authenticated principal and applies the scope in SQL for every call.