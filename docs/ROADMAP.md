# Roadmap

This file contains direction that is not yet the running product contract.

## Task management and Kanban

Track will add first-class task management. The target experience combines conversation-derived work with Kanban boards, explicit ownership, workflow status, evidence, and project/group visibility.

The replacement needs:

- a task domain model with board, column, status, assignee, priority, due date, and source evidence;
- project boards with group-aware visibility;
- explicit conversion from assistant or review output into tasks;
- task creation and management independent of AI;
- permission rules for viewing, creating, assigning, moving, and closing tasks;
- notifications, audit events, search, and mobile behavior;
- migration rules for any task-like information that users choose to bring forward from conversation or imported memory.

Until this ships, Track remains a conversation, evidence, memory, search, and audit workspace without a durable work-item model.

## Planning rule

Add an item here only when it represents agreed product direction. Implementation detail belongs in an issue or pull request. Remove roadmap text when the behavior ships, and update [PRODUCT.md](./PRODUCT.md) and [ARCHITECTURE.md](./ARCHITECTURE.md) in the same change.
