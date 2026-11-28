import { join } from 'node:path';
import { homedir } from 'node:os';
import { InvalidDraft, type Product } from '@noyau/extension-contract';

type Note = { title: string; body: string };

export const defaultDirectory = join(homedir(), '.noyau', 'notes');

export const notes: Product<Note> = {
  page: join(__dirname, '../editor.html'),
  initial: { title: '', body: '' },
  prepareSave(draft) {
    if (!draft || typeof draft !== 'object' ||
        !('title' in draft) || typeof draft.title !== 'string' ||
        !('body' in draft) || typeof draft.body !== 'string') {
      throw new InvalidDraft('标题和正文须为文本');
    }
    return { title: draft.title, body: draft.body };
  },
};
