const { parseArgs } = require('node:util');
const { defaultDirectory, createNotesProduct } = require('@noyau-example/notes');
const { serve } = require('@noyau/server');

const { positionals, values } = parseArgs({ allowPositionals: true, options: { ui: { type: 'string' } } });
const [directory = defaultDirectory, port = '3210'] = positionals;
serve(createNotesProduct(values.ui), directory, Number(port)).then(server => {
  process.once('SIGINT', server.close);
  process.once('SIGTERM', server.close);
  console.log(server.url);
}).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
