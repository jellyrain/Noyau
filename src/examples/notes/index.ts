import { join } from 'node:path';
import { homedir } from 'node:os';
import type { ModularProduct, Product } from '@noyau/extension-contract';
import { emptyNote, noteFields, noteModule, type Note } from './note-module';

export const defaultDirectory = join(homedir(), '.noyau', 'notes');

export function createNotesProduct(ui = 'vue'): ModularProduct & Product<Note> {
  if (ui !== 'vue' && ui !== 'react') throw new Error('笔记编辑器支持 vue 或 react');
  return {
    page: join(__dirname, 'ui', ui),
    modules: [noteModule],
    legacyRecord: { module: noteModule.id, key: 'first' },
    initial: emptyNote,
    prepareSave: noteFields,
  };
}

export const notes = createNotesProduct();
