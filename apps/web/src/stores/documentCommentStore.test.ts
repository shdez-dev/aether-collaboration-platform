import { selectDocumentComments, type DocumentCommentData } from './documentCommentStore';

describe('selectDocumentComments', () => {
  it('returns a stable empty array before comments have loaded', () => {
    const selector = selectDocumentComments('document-1');
    const state = { commentsByDocument: {} } as unknown as Parameters<typeof selector>[0];

    expect(selector(state)).toBe(selector(state));
  });

  it('returns the document comments array without replacing its reference', () => {
    const comments = [{ id: 'comment-1' }] as DocumentCommentData[];
    const selector = selectDocumentComments('document-1');
    const state = { commentsByDocument: { 'document-1': comments } } as unknown as Parameters<typeof selector>[0];

    expect(selector(state)).toBe(comments);
  });
});
