const { app } = require('electron');
const { defaultDirectory, notes } = require('@noyau-example/notes');
const { runDesktop } = require('@noyau/desktop');

const directory = app.commandLine.getSwitchValue('data-dir') || defaultDirectory;
runDesktop(notes, directory).catch(error => {
  console.error(error);
  app.exit(1);
});
