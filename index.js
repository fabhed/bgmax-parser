const { entryDefinitions } = require('./config');

// Extending String prototype with left and right trim methods
String.prototype.rtrim = function (s) {
  if (s === undefined) { s = '\\s'; }
  return this.replace(new RegExp(`[${s}]*$`), '');
};
String.prototype.ltrim = function (s) {
  if (s === undefined) { s = '\\s'; }
  return this.replace(new RegExp(`^[${s}]*`), '');
};

// Line parser function
function parseLine(line, lineNumber, entryObjForFormatting) {
  // Get the transaction code (always the first two characters of each line)
  const transactionCode = line.substring(0, 2);

  // Find the correct entryDefinition
  const entryDefinition = entryDefinitions
    .find(e => parseInt(e.transactionCode, 10) === parseInt(transactionCode, 10));

  // If no entryDefinition is find, skip this iteration by returning
  if (!entryDefinition) return;

  // Init the entry object
  const entryObj = { transactionCode, entryDefinition, properties: [] };

  let entryToFormat;

  // If the function should format 'reference' properties using a referenceCode
  let referenceCode;
  if (entryObjForFormatting) {
    referenceCode = entryObjForFormatting.properties.find(p => p.name === 'referenceCode').trimmedValue;
  }

  Object.keys(entryDefinition.properties).forEach((pName) => {
    let contentFormat; let paddingFormat;
    const property = entryDefinition.properties[pName];
    const rawValue = line.substring(property.startPos - 1, property.endPos);

    if (referenceCode && property.formatMap) {
      property.format = property.formatMap[referenceCode];
    }

    if (property.format) {
      let formatToUse;
      const possibleFormats = property.format.split('/');

      // The only property using multiple has the format string: 'N:h0/A:b',
      // where A:b is to be used if the value is only spaces
      if (possibleFormats.length === 1) [formatToUse] = possibleFormats;
      else if (rawValue.trim()) {
        [formatToUse] = possibleFormats;
      } else {
        [, formatToUse] = possibleFormats;
      }
      [contentFormat, paddingFormat] = formatToUse.split(':');
    } else if (property.formatMap) {
      entryToFormat = { lineNumber, transactionCode };
    }
    let trimmedValue;
    switch (paddingFormat) {
      // Högerställt och nollutfyllt
      case 'h0':
        trimmedValue = rawValue.ltrim('0');
        break;
      case 'vb':
        trimmedValue = rawValue.rtrim(' ');
        break;
      case 'hb':
        trimmedValue = rawValue.ltrim(' ');
        break;
      case 'b':
        trimmedValue = rawValue.trim();
        break;
      // No format specified
      default:
        trimmedValue = rawValue;
        break;
    }
    let formattedValue;
    switch (contentFormat) {
      // Numerical content
      case 'N':
        formattedValue = parseInt(trimmedValue, 10);
        break;
      // Alphanumerical content
      case 'A':
        formattedValue = trimmedValue;
        break;
      default:
        formattedValue = trimmedValue;
    }
    entryObj.properties.push({
      name: pName, trimmedValue, rawValue, value: formattedValue, contentFormat, paddingFormat,
    });
  });
  return { entryObj, entryToFormat };
}


/**
 * Parses Bankgirots Bg Max
 *
 * @param {String} bgMaxStr A string representing a raw Bg Max text file.
 * @returns {Object[]} An array of Objects containing all transactions
 */
function parser(bgMaxStr) {
  const parsedEntries = [];
  const allLines = bgMaxStr.split(/\r\n|\n|\r/); // Split every line
  const entriesToFormat = [];

  let lineNumber = 0;
  allLines.forEach((line) => {
    if (lineNumber > 10) return;
    const { entryObj, entryToFormat } = parseLine(line, lineNumber);
    if (entryToFormat) {
      entriesToFormat.push({ entryObj, entryToFormat });
    } else {
      parsedEntries.push(entryObj);
    }
    lineNumber += 1;
  });
  entriesToFormat.forEach(({ entryToFormat, entryObj }) => {
    const line = allLines[entryToFormat.lineNumber];
    const parsedLine = parseLine(line, entryToFormat.lineNumber, entryObj);
    parsedEntries.push(parsedLine.entryObj);
  });
  return parsedEntries;
};

module.exports = parser;
