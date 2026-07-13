# Roadmap

This file contains direction that is not yet the running product contract.

## Companies, relationships, and shared projects

Track will add first-class Companies that can form peer Relationships with two
or more Companies. Relationships authorize Companies to propose shared
Projects; they grant no Project or Channel access by themselves. Shared
Projects use neutral roles, explicit Company participation, explicit Channel
membership, non-destructive exit and archive rules, and a guided upgrade from
the current client/vendor Project model.

The approved product, access, lifecycle, migration, and implementation contract
is in
[COMPANY_RELATIONSHIPS_SPEC.md](./COMPANY_RELATIONSHIPS_SPEC.md).

The company model and task model share the same Project and Channel boundaries.
Their specifications must be reconciled before a combined release so legacy
roles and the current Group product noun do not survive into company-model
Projects.

## Task management and Kanban

Track will add first-class task management. The target experience combines conversation-derived work with Kanban boards, explicit ownership, workflow status, evidence, and project/channel visibility.

The approved product and implementation contract is in
[TASK_MANAGEMENT_SPEC.md](./TASK_MANAGEMENT_SPEC.md).

The replacement needs:

- a task domain model with boards, workflow states, assignee, priority, due date, and source evidence;
- project boards with channel-aware visibility;
- explicit conversion from source messages or assistant output into tasks;
- task creation and management independent of AI;
- permission rules for viewing, creating, assigning, moving, and closing tasks;
- notifications, audit events, search, and mobile behavior;
- migration rules for any task-like information that users choose to bring forward from conversation or imported memory.

Until this ships, Track remains a conversation, evidence, memory, and search workspace without a durable work-item model.

## Planning rule

Add an item here only when it represents agreed product direction. Implementation detail belongs in an issue or pull request. Remove roadmap text when the behavior ships, and update [PRODUCT.md](./PRODUCT.md) and [ARCHITECTURE.md](./ARCHITECTURE.md) in the same change.
