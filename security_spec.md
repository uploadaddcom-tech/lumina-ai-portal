# Firestore Security Specification

## Data Invariants
1. A user document can only be created or modified by the authenticated user with the matching UID.
2. A user's `email`, `uid`, and `createdAt` are immutable after creation.
3. `usageCount` can only be incremented by 1 at a time.
4. Users cannot modify other users' data.

## The Dirty Dozen Payloads (Designed to Fail)
1. **Unauthenticated Create**: Create user doc without being logged in.
2. **Identity Spoofing**: Create user doc with someone else's UID.
3. **Email Mutation**: Update `email` field after creation.
4. **Privilege Escalation**: Attempting to set an `isAdmin` field (not defined but good to check).
5. **Usage Jump**: Incrementing `usageCount` by 10 in one update.
6. **Shadow Update**: Adding a `verifed: true` field.
7. **Cross-User Update**: User A attempting to update User B's profile.
8. **Malicious ID**: Creating a user with a 2KB string as ID.
9. **Creation Timestamp Spoof**: Providing a future client-side `createdAt`.
10. **Type Poisoning**: Sending `usageCount: "1"` (string).
11. **Negative Usage**: Setting `usageCount` to -1.
12. **Blanket Read**: Attempting to list all users without a specific UID filter.

## Test Strategy
Verifying that all above payloads return PERMISSION_DENIED using `firestore.rules`.
