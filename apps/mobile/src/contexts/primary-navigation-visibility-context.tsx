import { createContext, useCallback, useContext, useMemo, useState } from 'react';

type PrimaryNavigationVisibility = {
  createAction: (() => void) | null;
  createContext: PrimaryCreateContext | null;
  hidden: boolean;
  setCreateAction: (action: (() => void) | null) => void;
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
  const [createAction, setCreateActionState] = useState<(() => void) | null>(null);
  const [createContext, setCreateContext] = useState<PrimaryCreateContext | null>(null);
  const setCreateAction = useCallback((action: (() => void) | null) => setCreateActionState(() => action), []);
  const value = useMemo(() => ({ createAction, createContext, hidden, setCreateAction, setCreateContext, setHidden }), [createAction, createContext, hidden, setCreateAction]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function usePrimaryNavigationVisibility() {
  const value = useContext(Context);
  if (!value) return { createAction: null, createContext: null, hidden: false, setCreateAction: () => undefined, setCreateContext: () => undefined, setHidden: () => undefined };
  return value;
}
