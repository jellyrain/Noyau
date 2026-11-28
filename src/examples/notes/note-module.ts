import { InvalidDraft, type ProductModule } from '@noyau/extension-contract';

export type Note = { title: string; body: string };
export const emptyNote: Note = { title: '', body: '' };

export function noteFields(draft: unknown): Note {
  if (!draft || typeof draft !== 'object' ||
      !('title' in draft) || typeof draft.title !== 'string' ||
      !('body' in draft) || typeof draft.body !== 'string') {
    throw new InvalidDraft('标题和正文须为文本');
  }
  return { title: draft.title, body: draft.body };
}

function noteId(value: unknown) {
  if (typeof value !== 'string' || !value.length) throw new InvalidDraft('缺少笔记标识');
  return value;
}

export const noteModule: ProductModule = {
  id: 'notes',
  operations: {
    read(id, store) {
      return store.get(noteId(id)) ?? emptyNote;
    },
    save(draft, store) {
      if (!draft || typeof draft !== 'object' || !('id' in draft)) throw new InvalidDraft('缺少笔记标识');
      store.set(noteId(draft.id), noteFields(draft));
    },
  },
};
