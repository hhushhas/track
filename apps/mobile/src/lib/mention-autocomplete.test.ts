import { describe, expect, it } from 'vitest';

import {
  applyMention,
  buildMentionCandidates,
  filterMentionCandidates,
  findMentionQuery,
  mentionHandle,
} from './mention-autocomplete';

function member(id: string, displayName: string, email: string) {
  return { membership: { _id: `pm-${id}` }, user: { _id: id, displayName, email } };
}

describe('mobile mention autocomplete', () => {
  it('finds the token the caret sits in', () => {
    expect(findMentionQuery('hey @ha', 7)).toEqual({ end: 7, query: 'ha', start: 4 });
    expect(findMentionQuery('@', 1)).toEqual({ end: 1, query: '', start: 0 });
    expect(findMentionQuery('hey @hasan there', 10)).toEqual({ end: 10, query: 'hasan', start: 4 });
  });

  it('ignores tokens that are not mentions', () => {
    expect(findMentionQuery('hey there', 9)).toBeNull();
    expect(findMentionQuery('mail me at hi@track.app', 23)).toBeNull();
    expect(findMentionQuery('hey @hasan done', 15)).toBeNull();
    expect(findMentionQuery('hey @hasan', 3)).toBeNull();
  });

  it('clamps a caret that has not caught up with the body', () => {
    expect(findMentionQuery('@ha', 99)).toEqual({ end: 3, query: 'ha', start: 0 });
  });

  it('inserts the handle with one trailing space', () => {
    expect(applyMention('hey @ha', { end: 7, query: 'ha', start: 4 }, 'hasan')).toEqual({
      caret: 11,
      text: 'hey @hasan ',
    });
    expect(applyMention('hey @ha done', { end: 7, query: 'ha', start: 4 }, 'hasan')).toEqual({
      caret: 11,
      text: 'hey @hasan done',
    });
  });

  it('ranks name-start matches above substring matches', () => {
    const candidates = buildMentionCandidates([
      member('u1', 'Sana Ahmed', 'sana@track.app'),
      member('u2', 'Hasan Shoaib', 'hasan@track.app'),
    ]);
    expect(filterMentionCandidates(candidates, 'sh').map((c) => c.handle)).toEqual(['hasanshoaib']);
    expect(filterMentionCandidates(candidates, 'a').map((c) => c.handle)).toEqual([
      'sanaahmed',
      'track',
      'hasanshoaib',
    ]);
    expect(filterMentionCandidates(candidates, 'tra').map((c) => c.handle)).toEqual(['track']);
  });

  it('offers the assistant first and members by name', () => {
    const candidates = buildMentionCandidates([
      member('u2', 'Sana Ahmed', 'sana@track.app'),
      member('u1', 'Hasan Shoaib', 'hasan@track.app'),
    ]);
    expect(candidates.map((c) => c.handle)).toEqual(['track', 'hasanshoaib', 'sanaahmed']);
    expect(candidates[0].kind).toBe('assistant');
  });

  it('excludes tombstoned deleted accounts', () => {
    const candidates = buildMentionCandidates([
      member('u1', 'Hasan Shoaib', 'hasan@track.app'),
      member('u2', 'Deleted Track user', 'deleted+u2@track.local'),
    ]);
    expect(candidates.map((c) => c.handle)).toEqual(['track', 'hasanshoaib']);
  });

  it('falls back to the email local part when two members share a name', () => {
    const candidates = buildMentionCandidates([
      member('u1', 'Sana Ahmed', 'sana.a@track.app'),
      member('u2', 'Sana Ahmed', 'sana.b@track.app'),
    ]);
    expect(candidates.map((c) => c.handle)).toEqual(['track', 'sana.a', 'sana.b']);
  });

  it('drops members without a user and de-duplicates repeated memberships', () => {
    const candidates = buildMentionCandidates([
      { membership: { _id: 'pm-1' }, user: null },
      member('u1', 'Hasan Shoaib', 'hasan@track.app'),
      member('u1', 'Hasan Shoaib', 'hasan@track.app'),
    ]);
    expect(candidates).toHaveLength(2);
  });

  it('normalises handles the way mention resolution does', () => {
    expect(mentionHandle(' Hasan Shoaib ')).toBe('hasanshoaib');
    expect(mentionHandle('Ana-María O’Neill')).toBe('ana-maraoneill');
  });
});
