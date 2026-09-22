import { createContext, useContext, useMemo, useState } from 'react';

type PrimaryNavigationVisibility = {
  createContext: PrimaryCreateContext | null;
  hidden: boolean;
  setCreateContext: (context: PrimaryCreateContext | null) => void;
  setHidden: (hidden: boolean) => void;
};

export type PrimaryCreateContext = {
  archive?: boolean;
  companyId?: string;
  groupId?: string;
  membershipId?: string;
  projectId: string;
  scope: 'channel' | 'project';
};

const Context = createContext<PrimaryNavigationVisibility | null>(null);

export function PrimaryNavigationVisibilityProvider({ children }: { children: React.ReactNode }) {
  const [hidden, setHidden] = useState(false);
  const [createContext, setCreateContext] = useState<PrimaryCreateContext | null>(null);
  const value = useMemo(() => ({ createContext, hidden, setCreateContext, setHidden }), [createContext, hidden]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function usePrimaryNavigationVisibility() {
  const value = useContext(Context);
  if (!value) return { createContext: null, hidden: false, setCreateContext: () => undefined, setHidden: () => undefined };
  return value;
}
