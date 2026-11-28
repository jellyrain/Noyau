import { app, BrowserWindow, protocol } from 'electron';
import { openProduct } from '@noyau/core';
import type { Product } from '@noyau/extension-contract';

const pageUrl = 'noyau://product/';

/** 从 Electron 主进程入口调用，在 ready 前注册产品页的协议。 */
export async function runDesktop(product: Product, directory: string) {
  protocol.registerSchemesAsPrivileged([{
    scheme: 'noyau',
    privileges: { standard: true, secure: true, supportFetchAPI: true },
  }]);
  await app.whenReady();
  const session = openProduct(product, directory);
  protocol.handle('noyau', request => {
    if (!request.url.startsWith(pageUrl)) return new Response(null, { status: 404 });
    return session.handle(request);
  });
  app.once('will-quit', () => {
    protocol.unhandle('noyau');
    session.close();
  });
  app.on('window-all-closed', () => app.quit());

  const window = new BrowserWindow({
    width: 840,
    height: 680,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => {
    if (!event.url.startsWith(pageUrl)) event.preventDefault();
  });
  await window.loadURL(pageUrl);
  return window;
}
