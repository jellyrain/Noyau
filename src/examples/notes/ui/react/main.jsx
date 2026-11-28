import React, { useEffect, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { edit, load, save, snapshot, subscribe } from '../editor.js';
import '../editor.css';

function Editor() {
  const state = useSyncExternalStore(subscribe, snapshot);
  useEffect(() => { void load(); }, []);
  return (
    <main>
      <header><h1>笔记</h1><small aria-label="框架版本">{state.version && 'Noyau ' + state.version}</small></header>
      <form onSubmit={event => { event.preventDefault(); void save(); }}>
        <fieldset disabled={!state.ready}>
          <label htmlFor="title">标题</label>
          <input id="title" value={state.title} onChange={event => edit('title', event.target.value)} />
          <label htmlFor="body">正文</label>
          <textarea id="body" value={state.body} onChange={event => edit('body', event.target.value)} />
        </fieldset>
        <footer>
          <output aria-live="polite">{state.status}</output>
          <button type="submit" disabled={!state.ready || state.saving}>保存</button>
        </footer>
      </form>
    </main>
  );
}

createRoot(document.getElementById('app')).render(<Editor />);
