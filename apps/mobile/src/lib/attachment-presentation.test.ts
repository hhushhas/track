import { describe, expect, it } from 'vitest';

import { fileTypeLabel, formatFileSize, isAutoAttachmentBody } from './attachment-presentation';

describe('mobile attachment presentation', () => {
  it('names the file kind from the extension, then the content type', () => {
    expect(fileTypeLabel({ contentType: 'application/pdf', filename: 'Scope.pdf' })).toBe('PDF');
    expect(fileTypeLabel({ contentType: 'image/png', filename: 'site photo' })).toBe('PNG');
    expect(fileTypeLabel({ contentType: 'audio/m4a', filename: 'note' })).toBe('M4A');
    expect(fileTypeLabel({ contentType: '', filename: 'anonymous' })).toBe('FILE');
  });

  it('reads the subtype out of a structured content type', () => {
    const wordType =
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    expect(fileTypeLabel({ contentType: wordType, filename: 'Handover' })).toBe('DOCUMENT');
  });

  it('keeps a long trailing word out of the kind label', () => {
    expect(fileTypeLabel({ contentType: 'image/jpeg', filename: 'photo.original' })).toBe('JPEG');
  });

  it('recognises the machine captions the bubble must not print', () => {
    expect(isAutoAttachmentBody('Voice note')).toBe(true);
    expect(isAutoAttachmentBody('Sent a voice note.')).toBe(true);
    expect(isAutoAttachmentBody('Attached Scope.pdf')).toBe(true);
    expect(isAutoAttachmentBody('Attached site photo.jpg')).toBe(true);
    expect(isAutoAttachmentBody('Attached 3 files')).toBe(true);
  });

  it('keeps a written caption that only reads like a machine one', () => {
    expect(isAutoAttachmentBody('Attached the scope, take a look')).toBe(false);
    expect(isAutoAttachmentBody('Here is the scope')).toBe(false);
  });

  it('formats sizes at the boundaries readers actually see', () => {
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(2048)).toBe('2 KB');
    expect(formatFileSize(5 * 1024 * 1024)).toBe('5.0 MB');
  });
});
