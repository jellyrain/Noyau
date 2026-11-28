const { app } = require('electron');
const { defaultDirectory, createNotesProduct } = require('@noyau-example/notes');
const { runDesktop } = require('@noyau/desktop');

const directory = app.commandLine.getSwitchValue('data-dir') || defaultDirectory;
const product = createNotesProduct(app.commandLine.getSwitchValue('ui') || 'vue');
runDesktop(product, directory).catch(error => {
  console.error(error);
  app.exit(1);
});
