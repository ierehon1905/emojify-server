const fs = require('fs');
const fontkit = require('fontkit');
const emoji = require('node-emoji');
const font = fontkit.openSync('./Apple Color Emoji.ttc').fonts[0];

let emo = emoji.get('100');
let run = font.layout("😀");
let glyph = run.glyphs[0].getImageForSize(160)

fs.writeFileSync('100.png', glyph.data);