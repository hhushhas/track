import type { FunctionReturnType } from 'convex/server';

import type { api } from '../../../../convex/_generated/api';

export type MyTask = FunctionReturnType<typeof api.mobile.listMyTasks>['page'][number];
export type ProjectEntry = FunctionReturnType<typeof api.mobile.listTaskProjects>['page'][number];
export type BoardEntry = FunctionReturnType<typeof api.taskBoards.listMine>[number];
