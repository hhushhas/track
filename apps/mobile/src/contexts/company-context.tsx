import { useQuery } from 'convex/react';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { api } from '../../../../convex/_generated/api';
import type { Doc, Id } from '../../../../convex/_generated/dataModel';
import { platformStorage } from '@/lib/platform-storage';
import { useReleaseConfig } from '@/lib/release-config';
import { useTrackUser } from './track-user-context';

const STORAGE_KEY = 'track.acting-company.v1';

type CompanyMembership = {
  company: Doc<'companies'> | null;
  membership: Doc<'companyMembers'>;
};

type CompanyContextValue = {
  actingCompanyId: Id<'companies'> | null;
  actingCompany: CompanyMembership | null;
  companies: CompanyMembership[] | undefined;
  companyModelEnabled: boolean;
  setActingCompanyId: (companyId: Id<'companies'> | null) => void;
};

const CompanyContext = createContext<CompanyContextValue | null>(null);

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const { trackUserId } = useTrackUser();
  const flags = useReleaseConfig();
  const companies = useQuery(api.companies.listMine, flags.companyModel && trackUserId ? {} : 'skip') as CompanyMembership[] | undefined;
  const [actingCompanyId, setSelectedCompanyId] = useState<Id<'companies'> | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void platformStorage.getItemAsync(STORAGE_KEY).then((stored) => {
      setSelectedCompanyId(stored as Id<'companies'> | null);
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!loaded || companies === undefined) return;
    if (actingCompanyId && !companies.some(({ company }) => company?._id === actingCompanyId && company.status === 'active')) {
      setSelectedCompanyId(null);
      void platformStorage.deleteItemAsync(STORAGE_KEY);
    }
  }, [actingCompanyId, companies, loaded]);

  function setActingCompanyId(companyId: Id<'companies'> | null) {
    setSelectedCompanyId(companyId);
    if (companyId) void platformStorage.setItemAsync(STORAGE_KEY, companyId);
    else void platformStorage.deleteItemAsync(STORAGE_KEY);
  }

  const value = useMemo<CompanyContextValue>(() => ({
    actingCompanyId: flags.companyModel ? actingCompanyId : null,
    actingCompany: companies?.find(({ company }) => company?._id === actingCompanyId) ?? null,
    companies,
    companyModelEnabled: flags.companyModel,
    setActingCompanyId,
  }), [actingCompanyId, companies, flags.companyModel]);

  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>;
}

export function useCompany() {
  const context = useContext(CompanyContext);
  if (!context) throw new Error('useCompany must be used inside CompanyProvider');
  return context;
}
