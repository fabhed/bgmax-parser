const fs = require('fs');
const parser = require('./index');

const content = fs.readFileSync('./example-files/bankgiroinbetalningar_exempelfil_avtal-om-ocr-kontroll_checksiffra_langd_sv.txt', 'latin1');
const parsedBgMax = parser(content);

// eslint-disable-next-line array-callback-return
parsedBgMax.map(e => e.properties.map((p) => {
  // eslint-disable-next-line no-console
  console.log(`${p.name}: ${p.value}`);
}));
