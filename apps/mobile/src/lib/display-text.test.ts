import { describe, expect, it } from 'vitest';

import { displayText } from './display-text';

describe('displayText', () => {
  it('decodes legacy encoded copy', () => expect(displayText('Fresh%20source%20review')).toBe('Fresh source review'));
  it('keeps ordinary percentages and malformed values safe', () => {
    expect(displayText('75% complete')).toBe('75% complete');
    expect(displayText('bad%ZZvalue')).toBe('bad%ZZvalue');
  });
});
