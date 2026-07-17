import { describe, expect, it } from 'vitest';

import { resolveReleaseConfig } from './release-config';

describe('mobile release config', () => {
  it('fails closed while the server projection is unavailable', () => {
    expect(resolveReleaseConfig(undefined)).toEqual({
      companyModel: false,
      tasks: false,
      threads: false,
    });
  });

  it('uses only the server projection once it is available', () => {
    expect(resolveReleaseConfig({
      companyModel: false,
      tasks: true,
      threads: true,
    })).toEqual({
      companyModel: false,
      tasks: true,
      threads: true,
    });
  });
});
