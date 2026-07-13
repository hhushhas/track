# Product

Track is a project collaboration workspace built around group conversation, references, and permission-aware AI assistance. It helps client and vendor teams keep decisions, scope changes, tasks, blockers, and commercial context connected to the messages that produced them.

## Current product model

A project contains members and groups. Group membership controls access to its messages, attachments, and AI answers. Project membership alone does not grant access to every group.

The current application supports:

- project and group creation, membership, invitations, and role management;
- realtime group chat, replies, forwarding, mentions, typing state, attachments, and voice notes;
- unread state, notification preferences, web push, and mobile push registration;
- `@track` answers grounded in accessible conversation, attachments, and imported project memory;
- project search, content reporting, account deletion, profile security, and two-factor authentication.

## Roles and access

Project roles are `owner`, `admin`, `staff`, and `client`.

- Owners and admins manage the project.
- Staff and clients access only the groups they join.
- Administrative authority never bypasses source-group membership.

Default groups reflect common visibility:

- General: owner, admin, staff, and client.
- Internal: owner, admin, and staff.
- Commercials: owner and admin.

Custom groups use explicit membership.

## References and AI rules

AI output is a proposal or an answer, never silent authority.

- `@track` uses only information the requesting user can access.
- Factual answers should cite their supporting messages, attachments, or imported memory.
- Unclear references produce an explicit uncertainty response.
- Imported memory is project-scoped and remains subject to project and group access checks.

## Platform coverage

The web app is the complete workspace, search, profile, and administration surface. The mobile app focuses on authentication, projects, groups, conversation, attachments, voice notes, assistant interactions, notification settings, reporting, and account deletion.
