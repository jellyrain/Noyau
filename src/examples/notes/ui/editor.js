import { callOperation, OperationError } from '@noyau/extension-contract/client';

let state = { title: '', body: '', version: '', ready: false, saving: false, status: '正在读取…' };
let revision = 0;
const listeners = new Set();

function update(patch) {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}

export const snapshot = () => state;
export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function load() {
  try {
    const { data, version } = await callOperation('notes', 'read', 'first');
    update({ title: data.title, body: data.body, version, ready: true, status: '' });
  } catch {
    update({ status: '无法读取笔记，请重新打开' });
  }
}

export function edit(field, value) {
  revision++;
  update({ [field]: value, status: '有未保存的修改' });
}

export async function save() {
  if (!state.ready || state.saving) return;
  const submitted = revision;
  const draft = { id: 'first', title: state.title, body: state.body };
  update({ saving: true, status: '正在保存…' });
  try {
    await callOperation('notes', 'save', draft);
    update({ status: submitted === revision ? '已保存' : '有未保存的修改' });
  } catch (error) {
    let status = '保存结果待确认，请重新打开核对';
    if (error instanceof OperationError && error.status >= 400 && error.status < 500) {
      status = error.status === 413 ? '未保存，笔记超过单次保存的大小限制' : '未保存，提交被拒绝（HTTP ' + error.status + '）';
    }
    update({ status });
  } finally {
    update({ saving: false });
  }
}
