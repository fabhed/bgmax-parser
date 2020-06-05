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
  const entryObj = {
    transactionCode,
    entryDefinition,
    properties: [],
    lineNumber,
  };

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
      name: pName,
      trimmedValue,
      rawValue,
      value: formattedValue,
      contentFormat,
      paddingFormat,
    });
  });
  return { entryObj, entryToFormat };
}


/**
 * Creates a tree-structure out of the parsedEntries
 * This structure removes a lot of unnecesary data and is meant to be used in most implementations
 * @param {*} parsedEntries
 * @returns
 */
function makeTree(parsedEntries) {
  // Remove all contextual information from the data
  const formatted = parsedEntries.map((entry) => {
    // As we only want key/value pairs we convert the properties from an array to an object.
    const props = {};
    entry.properties.forEach((p) => {
      props[p.name] = p.value;
    });

    return {
      entryName: entry.entryDefinition.name,
      code: entry.transactionCode,
      properties: props,
    };
  });

  // Get the start and end-posts
  const start = formatted.find(e => e.code === '01');
  const end = formatted.find(e => e.code === '70');

  // This will remove the next section
  function extractSection() {
    const sectionStart = formatted.findIndex(e => e.code === '05');
    const sectionEnd = formatted.findIndex(e => e.code === '15');
    const section = formatted.splice(sectionStart, sectionEnd - sectionStart + 1);
    return section;
  }

  // Collect all sections
  const sections = [];
  while (formatted.findIndex(e => e.code === '05') > -1) {
    sections.push(extractSection());
  }

  // Payment Or Deduction Codes
  const codes = ['20', '21'];
  // Format Payments and Deductions in each section
  const sectionNodes = sections.map((entriesInSection) => {
    // This will remove and format the next payment/deduction
    function extractPaymentDeduction() {
      const pOrDIndex = entriesInSection.findIndex(e => codes.includes(e.code));
      const pOrD = entriesInSection.splice(pOrDIndex, 1);
      // Payment or Deduction will end on either the next
      // Payment or Deduction or the Section end (15)
      const endCodes = codes.concat(['15']);

      // As we delete the current payment/deduction from the array
      // the same index will point to the next element in the array
      let cursor = pOrDIndex;
      // Get all entries belonging to the payment
      // Go on until we hit an endCode
      const children = [];
      while (!endCodes.includes(entriesInSection[cursor].code)) {
        const entry = entriesInSection[cursor];
        children.push(entry);
        cursor += 1;
      }
      return {
        properties: Object.assign({}, pOrD[0].properties),
        extraInfo: children,
      };
    }

    // Extract all payments/deductions as children to the current section
    const paymentsAndDeductions = [];
    while (entriesInSection.findIndex(e => codes.includes(e.code)) > -1) {
      // Add payment as a child to the section
      paymentsAndDeductions.push(extractPaymentDeduction());
    }

    // Create a section node
    const sectionProps = Object.assign(
      {},
      entriesInSection[0].properties, // Start of section props
      entriesInSection[entriesInSection.length - 1].properties, // End of section props
    );
    return {
      properties: sectionProps,
      paymentsAndDeductions,
    };
  });

  // Create the top-level of the tree
  const tree = {
    properties: Object.assign({}, start.properties, end.properties),
    sections: sectionNodes,
  };
  return tree;
}

/**
 * Parses Bankgirots Bg Max
 *
 * @param {String} bgMaxStr A string representing a raw Bg Max text file.
 * @param {Boolean} treeStructure If true the parser will output the data organized as a tree.
 *  If false the output will be un-organized and contain all contextual data.
 * @returns {Object[]} An array of Objects containing all transactions
 */
function parser(bgMaxStr, treeStructure = true) {
  if (typeof bgMaxStr !== 'string') {
    throw new Error('bgMaxStr parameter should be a string');
  }
  if (bgMaxStr === '') {
    throw new Error('bgMaxStr should not be an empty string');
  }
  if (bgMaxStr.substr(0, 7) !== '01BGMAX') {
    throw new Error('All BgMax files should start with: "01BGMAX"');
  }
  const parsedEntries = [];
  const allLines = bgMaxStr.split(/\r\n|\n|\r/); // Split every line
  if (allLines[allLines.length - 1].substr(0, 2) !== '70') throw new Error('Last line needs to start with "70"');
  const entriesToFormat = [];
  let lineNumber = 0;
  allLines.forEach((line) => {
    // if (lineNumber > 10) return;
    const { entryObj, entryToFormat } = parseLine(line, lineNumber);
    if (entryToFormat) {
      entriesToFormat.push({ entryObj, entryToFormat });
    } else {
      parsedEntries.push(entryObj);
    }
    lineNumber += 1;
  });

  // Second pass where we format some entries with 'reference'
  entriesToFormat.forEach(({ entryToFormat, entryObj }) => {
    const line = allLines[entryToFormat.lineNumber];
    const parsedLine = parseLine(line, entryToFormat.lineNumber, entryObj);
    parsedEntries.push(parsedLine.entryObj);
  });

  // Re-order entries according to lineNumber (order is lost because of the two passes)
  const sortedParsedEntries = parsedEntries.sort((a, b) => a.lineNumber - b.lineNumber);

  if (!treeStructure) {
    return sortedParsedEntries;
  }
  return makeTree(sortedParsedEntries);
}

module.exports = parser;
