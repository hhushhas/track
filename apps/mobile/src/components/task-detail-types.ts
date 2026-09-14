import type { FunctionReturnType } from 'convex/server';

import type { api } from '../../../../convex/_generated/api';

export type MobileTaskDetail = NonNullable<FunctionReturnType<typeof api.tasks.getByKey>>;

export type TaskEditField =
  | 'assignee'
  | 'description'
  | 'dueDate'
  | 'labels'
  | 'more'
  | 'priority'
  | 'status';

export type MobileTaskBoard = FunctionReturnType<typeof api.taskBoards.list>[number];

export type MobileTaskAssignee = FunctionReturnType<typeof api.tasks.listEligibleAssignees>[number];

export type MobileTaskListItem = FunctionReturnType<typeof api.tasks.listChildren>['page'][number];

export type MobileTaskView = FunctionReturnType<typeof api.tasks.listPage>['page'][number];

export type MobileBoardView = FunctionReturnType<typeof api.taskBoards.list>[number];

export type MobileSuggestionView = FunctionReturnType<typeof api.taskSuggestions.list>[number];
