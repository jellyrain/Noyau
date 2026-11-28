import { app, BrowserWindow, protocol } from 'electron';
import { openProduct } from '@noyau/core';
import type { ProductEntry } from '@noyau/extension-contract';

const pageUrl = 'noyau://product/';

/** 须在 Electron 主进程的 ready 事件前调用。 */
export async function runDesktop(product: ProductEntry, directory: string) {
  protocol.registerSchemesAsPrivileged([{
    scheme: 'noyau',
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true },
  }]);
  await app.whenReady();
  const session = openProduct(product, directory);
  protocol.handle('noyau', request => {
    if (!request.url.startsWith(pageUrl)) return new Response(null, { status: 404 });
    return session.handle(request);
  });
  app.once('will-quit', event => {
    protocol.unhandle('noyau');
    const draining = session.close();
    if (draining) {
      event.preventDefault();
      draining.then(() => setImmediate(() => app.quit()), error => {
        console.error(error);
        app.exit(1);
      });
    }
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
