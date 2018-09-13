'use strict'
const startTime = Date.now();

const INPUT = process.env.INPUT || 'source_mojis.txt';
const OUTPUT = process.env.OUTPUT || 'results.json';
const PREVIOUS = process.env.PREVIOUS || OUTPUT;
const SPACING = process.env.SPACING || undefined;

const MINIMUM_TAG_SHARE = 0.6;
const NULL_ARRAY = [ null, null, null, null, null ];
const LEFT_SIDES = '([{༼|ʕ⁽ᶘˁ〳₍꒰⌈UＵ∪⎩╏ᘳ།Ꮚ（'.split('');
const RIGHT_SIDES = ')]}༽|ʔ⁾ᶅˀ〵₎꒱⌉UＵ∪⎭╏ᘰ།Ꮚ）'.split('');
const SINGLE_CHAR_FACES = 'ツᐛᐖ∵Ö⌓̈'.split('');
const MIRRORED_EYES = {
  '́': '̀',
  '̀': '́',
  'ˊ': 'ˋ',
  'ˋ': 'ˊ',
  '̀': '́',
  '́': '̀',
  '´': '｀',
  '｀': '´',
  '᷄': '᷅',
  '᷅': '᷄',
  '˃': '˂',
  '˂': '˃',
  'ó': 'ò',
  'ò': 'ó',
  '˂': '˃',
  '˃': '˂',
  '<': '>',
  '>': '<',
  '˒': '˓',
  '˓': '˒',
  '⊂': '⊃',
  '⊃': '⊂',
  '╰': '╯',
  '╯': '╰'
};
const BAD_CHARS = [
  811,
  860,
  865,
  2636,
  3642,
  3665,
  4349,
  8408,
  8409,
  8807,
  9678,
  9770,
  9774,
  10047,
  11193,
  58164,
  59132,
  65417,
  65507,
  65533
];

const fs = require('fs');
const mojis = fs.readFileSync(INPUT)
  .toString()
  .replace(/ /g, '')
  .split(/[\t\n]/);
const prevResults = (() => {
  try { return require('./' + PREVIOUS); }
  catch (e) { return { mouths: {}, eyes: {} }; }
})();

// Split moji into left, right, and middle using the innermost face sides
const parseSides = moji => {
  const mojiArray = moji.split('');
  const halfLength = Math.ceil(moji.length / 2);

  const leftIndex = halfLength - 1 - mojiArray
    .slice(0, halfLength)
    .reverse()
    .findIndex(char => LEFT_SIDES.includes(char))
  const rightIndex = moji.length - halfLength + mojiArray
    .slice(moji.length - halfLength)
    .findIndex(char => RIGHT_SIDES.includes(char))

  // Kaomoji without two sides to the face will have parsing errors later
  if (leftIndex === halfLength - 1 - (-1)) {
    return NULL_ARRAY;
  }
  if (rightIndex === moji.length - halfLength + (-1)) {
    return NULL_ARRAY;
  }

  const leftSide = moji[leftIndex];
  const rightSide = moji[rightIndex];

  // Kaomoji with mismatching sides may have been parsed in error
  if (LEFT_SIDES.indexOf(leftSide) !== RIGHT_SIDES.indexOf(rightSide)) {
    return NULL_ARRAY;
  }

  return [
    moji.slice(0, leftIndex),
    leftSide,
    moji.slice(leftIndex + 1, rightIndex),
    rightSide,
    moji.slice(rightIndex + 1)
  ];
}

// Detects whether arms are inside or outside the face, and splits them off
const parseArms = (left, mid, right) => {
  const isLeftFacing = left.slice(-1) && left.slice(-1) === mid.slice(-1);
  const isRightFacing = right[0] && right[0] === mid[0];

  if (isLeftFacing && !isRightFacing) {
    return [
      left.slice(0, -1),
      left.slice(-1) + left.slice(-1),
      mid.slice(0, -1),
      '',
      right
    ]
  }

  if (isRightFacing && !isLeftFacing) {
    return [
      left,
      '',
      mid.slice(1),
      right[0] + right[0],
      right.slice(1)
    ]
  }

  return [
    left.slice(0, -1),
    left.slice(-1),
    mid,
    right[0] || '',
    right.slice(1)
  ];
}

// Splits face characters into mouth, eyes, surrounding characters
const parseFace = face => {
  if (face.length < 3) return NULL_ARRAY;
  const midIndex = Math.floor(face.length / 2);


  // If a previous mouth is in the middle, use as basis for split
  const maybeMouths = face.length % 2 === 0
    ? [
        [face.slice(midIndex - 1, midIndex + 1), midIndex - 1],
        [face[midIndex - 1], midIndex - 1],
        [face[midIndex], midIndex]
      ]
    : [
        [face.slice(midIndex - 1, midIndex + 1), midIndex - 1],
        [face.slice(midIndex, midIndex + 2), midIndex],
        [face[midIndex - 1], midIndex - 1],
        [face[midIndex], midIndex],
        [face[midIndex + 1], midIndex +1]
      ];


  let matchedMouths = maybeMouths.filter(mouthTuple => {
    const mouth = mouthTuple[0];
    return prevResults.mouths[mouth] || results.mouths[mouth];
  });


  // If there is more than one match, try to narrow by matching eyes
  if (matchedMouths.length > 1) {
    matchedMouths = matchedMouths.filter(mouthTuple => {
      const index = mouthTuple[1];
      const leftEye = face[index - 1];
      const rightEye = face[index + mouthTuple[0].length];
      if (!leftEye || !rightEye) return false;

      const eyes = leftEye + '%' + rightEye;
      return prevResults.eyes[eyes] || results.eyes[eyes];
    })
  }


  // If only one match, use mouth
  if (matchedMouths.length === 1) {
    const mouth = matchedMouths[0][0]
    const mouthIndex = matchedMouths[0][1];


    return [
      face.slice(0, mouthIndex -1),
      face[mouthIndex - 1] || '',
      mouth,
      face[mouthIndex + mouth.length] || '',
      face.slice(mouthIndex + mouth.length + 1)
    ]
  }

  // Otherwise looks for symmetrical pairs, store as tuples with
  // indexes of symmetrical pairs in order from inner to outer
  const pairs = face.split('')
    .reduce((charIndexes, char, index) => {
      const prevIndex = charIndexes.findIndex(ci => {
        return ci.chars[0] === char || MIRRORED_EYES[char] === ci.chars[0];
      });

      if (prevIndex === -1) {
        charIndexes.push({ chars: [char], idxs: [index] });
      } else {
        charIndexes[prevIndex].chars.push(char);
        charIndexes[prevIndex].idxs.push(index);
      };

      return charIndexes;
    }, [])
    .filter(indexes => indexes.idxs.length === 2)
    .reverse()
    .reduce((finished, { chars, idxs }, i, pairs) => {
      const next = pairs[i + 1] || { idxs: [] };

      // Interspersed pairs are a single unit
      if (idxs[0] - next.idxs[0] === 1 && idxs[1] - next.idxs[1] === 1) {
        next.chars[0] += chars[0];
        next.chars[1] += chars[1];
      } else {
        finished.push({ chars, idxs })
      }
      return finished;
    }, []);

  // No symmetrical pairs, center char is mouth, reject if even number of char
  if (pairs.length === 0) {
    if (face.length % 2 === 0) return NULL_ARRAY;
    return [
      face.slice(0, midIndex - 1),
      face[midIndex - 1],
      face[midIndex],
      face[midIndex + 1],
      face.slice(midIndex + 2)
    ];
  }

  // If more than one pair, innermost pair is a mouth if adjacent
  const eyes = pairs.length > 1 && pairs[0].idxs[1] - pairs[0].idxs[0] === 1
    ? pairs[1]
    : pairs[0];

  return [
    face.slice(0, eyes.idxs[0]),
    eyes.chars[0],
    face.slice(eyes.idxs[0] + eyes.chars[0].length, eyes.idxs[1]),
    eyes.chars[1],
    face.slice(eyes.idxs[1] + eyes.chars.length)
  ];
};

// Updates results for a part
const tally = (category, part) => {
  if (!category[part]) {
    category[part] = {
      count: 1,
      tags: tagKeys.reduce((tags, t) => ({ [t]: {}, ...tags }), {})
    }
  } else {
    category[part].count++;
  }

  tagKeys.forEach(type => {
    const tag = tags[type];
    if (!tag) return;
    const tagType = category[part].tags[type];
    tagType[tag] = tagType[tag] + 1 || 1;
  })
};

// Build results object
const resultKeys = [ 'outsides', 'arms', 'sides', 'insides', 'eyes', 'mouths' ];
const results = resultKeys.reduce((results, s) => ({ [s]: {}, ...results }), {});
const tagKeys = [ 'emotion', 'animal', 'OTHER' ];
const tags = tagKeys.reduce((tags, t) => ({ [t]: '', ...tags }), {});
const individualKeys = [ 'count', 'tags' ];

mojis.forEach(moji => {
  // `%` is an escape character, we must omit any kaomoji including it
  if (moji.includes('%')) return;
  if (BAD_CHARS.find(code => moji.includes(String.fromCharCode(code)))) return;

  // Update tags
  if (moji.slice(0, 3) === '###') {
    const newTags = moji.slice(3).split(',')
    tags.emotion = newTags[0];
    tags.animal = newTags[1] || 'NOT_ANIMAL';
    tags.OTHER = newTags[2];
    return;
  }

  const [ lt, leftSide, mid, rightSide, rt ] = parseSides(moji);
  if (lt === null) return;
  if (!leftSide|| !rightSide) return;


  const [leftOut, leftArm, face, rightArm, rightOut] = parseArms(lt, mid, rt);
  if (leftOut === null) return;
  if (RIGHT_SIDES.concat(LEFT_SIDES).find(side => face.includes(side))) return;

  if (SINGLE_CHAR_FACES.includes(face)) {
    tally(results.eyes, face);
  } else {
    const [ leftIn, leftEye, mouth, rightEye, rightIn ] = parseFace(face);
    if (leftIn === null) return;
    if (!leftEye || !rightEye || !mouth) return;

    tally(results.mouths, mouth);
    tally(results.eyes, leftEye + '%' + rightEye);
    tally(results.insides, leftIn + '%' + rightIn);
  }

  tally(results.arms, leftArm + '%' + rightArm);
  tally(results.sides, leftSide + '%' + rightSide);
  tally(results.outsides, leftOut + '%' + rightOut);
})

// Transform tags objects into an array
resultKeys.forEach(resultKey => {
  Object.keys(results[resultKey]).forEach(part => {
    const counts = results[resultKey][part];
    counts.tags = tagKeys.slice(0, -1)
      .map(categoryName => {
        // Only keep a tag if it has a large enough majority in its category
        const category = counts.tags[categoryName];
        const catKeys = Object.keys(category);

        const total = catKeys.reduce((t, c) => t + category[c], 0);
        const [ count, largest ] = catKeys.reduce((kept, tag) => {
          if (category[tag] <= kept[0]) return kept;
          return [category[tag], tag];
        }, [0, null]);

        if (count / total > MINIMUM_TAG_SHARE) {
          return largest;
        }
        return null;
      })
      .filter(tag => tag !== null && tag !== 'NOT_ANIMAL')
      .concat(Object.keys(counts.tags.OTHER).filter(otherTag => {
        return counts.tags.OTHER[otherTag] / counts.count > MINIMUM_TAG_SHARE;
      }));
  });
});

// Build sorted keys array
const sortedKeys = resultKeys
  .reduce((keys, categoryName) => {
    return keys.concat(Object.keys(results[categoryName]))
  }, resultKeys)
  .concat(individualKeys)
  .sort();

// Write output
const secs = (Date.now() - startTime) / 1000;
console.log(`Processed ${mojis.length} kaomoji in ${secs.toFixed(3)} seconds`);
console.log();

console.log('Tags used:')
const tagsUsed = Object.keys(results).reduce((tags, category) => {
  Object.keys(results[category]).forEach(part => {
    results[category][part].tags.forEach(tag => tags[tag] = true)
  })
  return tags;
}, {});
console.log(Object.keys(tagsUsed).sort().join(', '));
console.log();

console.log('Writing file...');
fs.writeFileSync(OUTPUT, JSON.stringify(results, sortedKeys, SPACING), 'utf8');
console.log('Done.');
