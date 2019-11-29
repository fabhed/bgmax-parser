const fs = require('fs');
const parser = require('../index');

const expectedObject = require('./expected.json');

test('checks if example file is parsed as expected', () => {
  const content = fs.readFileSync('./example-files/bankgiroinbetalningar_exempelfil_avtal-om-ocr-kontroll_checksiffra_langd_sv.txt', 'latin1');
  const parsedBgMax = parser(content);
  expect(parsedBgMax).toEqual(expectedObject);
});
