import { PrimaryStack } from '@/components/primary-stack';

export const unstable_settings = { initialRouteName: 'tasks' };

export default function TasksStackLayout() {
  return <PrimaryStack initialRouteName="tasks" />;
}
