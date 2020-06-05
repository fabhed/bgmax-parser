const fs = require('fs');
const parser = require('../index');

const expectedObject = require('./expected.json');

test('checks if example file is parsed as expected', () => {
  const content = fs.readFileSync('./example-files/bankgiroinbetalningar_exempelfil_avtal-om-ocr-kontroll_checksiffra_langd_sv.txt', 'latin1');
  const parsedBgMax = parser(content);
  expect(parsedBgMax).toEqual(expectedObject);
});


test('check if incorrect input is detected', () => {
  const empty = () => parser('');
  expect(empty).toThrow();

  const notString = () => parser(1);
  expect(notString).toThrow();

  const missingStartPost = () => parser('a01BGMAX');
  expect(missingStartPost).toThrow();

  const missingEndRecord = () => parser('01BGMAX               0120040525173035010331P                                   ');
  // console.log(invalid()[0].properties);
  expect(missingEndRecord).toThrow();
});
