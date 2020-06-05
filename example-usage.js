const fs = require('fs');
const parser = require('./index');

const content = fs.readFileSync('./example-files/bankgiroinbetalningar_exempelfil_avtal-om-ocr-kontroll_checksiffra_langd_sv.txt', 'latin1');
const parsedBgMax = parser(content);

console.log(parsedBgMax);
