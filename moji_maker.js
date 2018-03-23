'use strict'

const INPUT = process.env.INPUT || 'results.json';
const COUNT = process.env.COUNT || 1;
const source = require('./' + INPUT);

const DNA_SIZE = 2 ** (8 * 2);
const AVERAGE_CHANCE = 0.25;
const DOMINANT_CHANCE = 0.75;
const MUTATION_CHANCE = 0.5;
const MUTATION_SIZE = 8;

const GENE_TYPES = [
  'mouths',
  'WHITESPACE',
  'eyes',
  'insides',
  'WHITESPACE',
  'sides',
  'arms',
  'outsides',
  'WHITESPACE'
];

// Build arrays of tuples for each part category with the format:
//   [[<part>, [<tags>]], [<part>, [<tags>]]]
const parts = Object.keys(source).reduce((parts, category) => {
  parts[category] = Object.keys(source[category])
    .reduce((catArray, part) => {
      const count = source[category][part].count;
      const tags = source[category][part].tags;
      return catArray.concat(Array
        .apply(null, Array(count))
        .map(() => [part, tags]));
    }, []);
    return parts;
}, {});

const randomDna = length => {
  return Array.apply(null, Array(length)).map(() => {
    return Math.floor(Math.random() * DNA_SIZE);
  })
};

const dnaToString = dnaArray => {
  return dnaArray
    .map(num => ('0000' + num.toString(16)).slice(-4))
    .join('');
};

const dnaToArray = dnaString => {
  return dnaString
    .match(/[0-9a-f]{4,4}/g)
    .map(hex => parseInt(hex, 16));
}

const getPart = (category, indexDna, whitespaceDna) => {
  const conversion = parts[category].length / DNA_SIZE;
  const partIndex = Math.floor(indexDna * conversion);
  const part = parts[category][partIndex];
  if (!whitespaceDna) return part;

  const spaces = whitespaceDna.toString(2).split('').map(b => Number(b));
  const spacedPart = part[0].split('').map((char, i) => {
    if (i === 0 && spaces[0]) char = ' ' + char;
    return spaces[i + 1] ? char + ' ' : char;
  }).join('');
  return [spacedPart, part[1]]
};

const getMojiParts = dnaArray => {
  // DNA should be in the order:
  //   mouth, eyes, insides, sides, arms, outsides
  return {
    mouth: getPart('mouths', dnaArray[0], dnaArray[1]),
    eyes: getPart('eyes', dnaArray[2]),
    insides: getPart('insides', dnaArray[3], dnaArray[4]),
    sides: getPart('sides', dnaArray[5]),
    arms: getPart('arms', dnaArray[6]),
    outsides: getPart('outsides', dnaArray[7], dnaArray[8])
  };
};

const getTags = mojiParts => {
  const tagSet = Object.keys(mojiParts)
    .map(partKey => mojiParts[partKey][1])
    .reduce((flat, tags) => flat.concat(tags), [])
    .reduce((tagSet, tag) => ({ [tag]: true, ...tagSet }), {});

  return Object.keys(tagSet);
}

const displayCryptomoji = mojiParts => {
  const parts = Object.keys(mojiParts)
    .map(partKey => [partKey, mojiParts[partKey][0]])
    .reduce((parts, [k, v]) => ({ [k]: v, ...parts }), {});

  let moji = parts.mouth;
  moji = parts.eyes.replace('%', moji);
  moji = parts.insides.replace('%', moji);
  moji = parts.sides.replace('%', moji);

  // Add off center arms if applicable
  const isOffRight = parts.arms.length === 3 &&
    parts.arms[0] === '%' &&
    parts.arms[1] === parts.arms[2];
  const isOffLeft = parts.arms.length === 3 &&
    parts.arms[2] === '%' &&
    parts.arms[0] === parts.arms[1];
  if (isOffRight) {
    moji = moji[0] + parts.arms[1] + moji.slice(1) + parts.arms[2];
  } else if (isOffLeft) {
    moji = parts.arms[0] + moji.slice(0, -1) + parts.arms[1] + moji.slice(-1);
  } else {
    moji = parts.arms.replace('%', moji);
  }

  moji = parts.outsides.replace('%', moji);

  return moji.trim();
}

const spawnCryptomoji = () => {
  const categories = Object.keys(parts);
  const dnaArray = randomDna(GENE_TYPES.length);
  return dnaToString(dnaArray);
};

const breedCryptomoji = (sireDna, breederDna) => {
  const sireArray = dnaToArray(sireDna);
  const breederArray = dnaToArray(breederDna);

  const childArray = sireArray
    .map((gene, i) => [gene, breederArray[i]])
    .map(([sGene, bGene], i) => {
      if (Math.random() < AVERAGE_CHANCE) {
        return Math.floor((sGene + bGene) / 2);
      }

      if (GENE_TYPES[i] === 'WHITESPACE') {
        return Math.random() < 0.5 ? sGene : bGene;
      }

      const counts = source[GENE_TYPES[i]];
      const sPart = getPart(GENE_TYPES[i], sGene)[0];
      const bPart = getPart(GENE_TYPES[i], bGene)[0];
      const sCount = counts[sPart].count;
      const bCount = counts[bPart].count;

      if (Math.random() < DOMINANT_CHANCE) {
        return sCount > bCount ? sGene : bGene;
      }
      return sCount < bCount ? sGene : bGene;
    })
    .map((gene, i) => {
      if (Math.random() > MUTATION_CHANCE) return gene;
      const shift = Math.floor(Math.random() * 2 * MUTATION_SIZE) - MUTATION_SIZE;

      if (GENE_TYPES[i] === 'WHITESPACE') return gene + shift;

      const conversion = DNA_SIZE / parts[GENE_TYPES[i]].length;
      return gene + Math.floor(shift * conversion);
    });

  return dnaToString(childArray);
};

const parseDna = dna => {
  const dnaArray = dnaToArray(dna);
  const mojiParts = getMojiParts(dnaArray);

  return {
    moji: displayCryptomoji(mojiParts),
    dna,
    tags: getTags(mojiParts)
  };
}

const printMoji = dna => {
  const { moji, tags } = parseDna(dna);
  console.log(moji);
  console.log(tags);
  console.log(dna);
  console.log();
}

for (let i = 0; i < COUNT; i++) {
  const sire = spawnCryptomoji();
  const breeder = spawnCryptomoji();

  console.log('---------');
  console.log();
  console.log('Parents:');
  printMoji(sire);
  printMoji(breeder);
  console.log();
  console.log('Children:');
  printMoji(breedCryptomoji(sire, breeder));
  printMoji(breedCryptomoji(sire, breeder));
  printMoji(breedCryptomoji(sire, breeder));
  console.log('---------');
  console.log();
}
