const { defaultDirectory, notes } = require('@noyau-example/notes');
const { serve } = require('@noyau/server');

const directory = process.argv[2] ?? defaultDirectory;
const port = Number(process.argv[3] ?? 3210);
serve(notes, directory, port).then(server => {
  process.once('SIGINT', server.close);
  process.once('SIGTERM', server.close);
  console.log(server.url);
}).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
