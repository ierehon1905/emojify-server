const express = require("express")
const {
  createCanvas,
  loadImage,
  registerFont,
  createImageData
} = require("canvas")
const fontkit = require("fontkit")
const font = fontkit.openSync(".fonts/Apple_Color_Emoji.ttc").fonts[0]
const app = express()
const port = 3000
const fx = Math.sqrt(Math.pow(1440 * 0.35, 2) - Math.pow((1080 * 0.5) / 2, 2))

//var AppleColorEmoji = new Font('Apple Color Emoji', fontFile('Apple Color Emoji.ttf'));
//registerFont("./Apple Color Emoji.ttc", { family: "HUI" })

const proportion = (min, max, initMin, initMax, val) => {
  return ((val - initMin) * (max - min)) / (initMax - initMin) + min
}

const dist = (x1, y1, x2, y2) => {
  return Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2))
}

const _getARGB = function(data, i) {
  var offset = i * 4
  return (
    ((data[offset + 3] << 24) & 0xff000000) |
    ((data[offset] << 16) & 0x00ff0000) |
    ((data[offset + 1] << 8) & 0x0000ff00) |
    (data[offset + 2] & 0x000000ff)
  )
}

const _setPixels = function(pixels, data) {
  var offset = 0
  for (var i = 0, al = pixels.length; i < al; i++) {
    offset = i * 4
    pixels[offset + 0] = (data[i] & 0x00ff0000) >>> 16
    pixels[offset + 1] = (data[i] & 0x0000ff00) >>> 8
    pixels[offset + 2] = data[i] & 0x000000ff
    pixels[offset + 3] = (data[i] & 0xff000000) >>> 24
  }
}

var blurRadius
var blurKernelSize
var blurKernel
var blurMult

function buildBlurKernel(r) {
  var radius = (r * 3.5) | 0
  radius = radius < 1 ? 1 : radius < 248 ? radius : 248

  if (blurRadius !== radius) {
    blurRadius = radius
    blurKernelSize = (1 + blurRadius) << 1
    blurKernel = new Int32Array(blurKernelSize)
    blurMult = new Array(blurKernelSize)
    for (var l = 0; l < blurKernelSize; l++) {
      blurMult[l] = new Int32Array(256)
    }

    var bk, bki
    var bm, bmi

    for (var i = 1, radiusi = radius - 1; i < radius; i++) {
      blurKernel[radius + i] = blurKernel[radiusi] = bki = radiusi * radiusi
      bm = blurMult[radius + i]
      bmi = blurMult[radiusi--]
      for (var j = 0; j < 256; j++) {
        bm[j] = bmi[j] = bki * j
      }
    }
    bk = blurKernel[radius] = radius * radius
    bm = blurMult[radius]

    for (var k = 0; k < 256; k++) {
      bm[k] = bk * k
    }
  }
}

function blurARGB(canvas, radius) {
  //var pixels = new Uint8ClampedArray(canvas.toBuffer("image/png"))
  var pixels = canvas
    .getContext("2d")
    .getImageData(0, 0, canvas.width, canvas.height).data
  // var pixels = Filters._toPixels(canvas);
  var width = canvas.width
  var height = canvas.height
  var numPackedPixels = width * height
  var argb = new Int32Array(numPackedPixels)
  for (var j = 0; j < numPackedPixels; j++) {
    argb[j] = _getARGB(pixels, j)
  }
  var sum, cr, cg, cb, ca
  var read, ri, ym, ymi, bk0
  var a2 = new Int32Array(numPackedPixels)
  var r2 = new Int32Array(numPackedPixels)
  var g2 = new Int32Array(numPackedPixels)
  var b2 = new Int32Array(numPackedPixels)
  var yi = 0
  buildBlurKernel(radius)
  var x, y, i
  var bm
  for (y = 0; y < height; y++) {
    for (x = 0; x < width; x++) {
      cb = cg = cr = ca = sum = 0
      read = x - blurRadius
      if (read < 0) {
        bk0 = -read
        read = 0
      } else {
        if (read >= width) {
          break
        }
        bk0 = 0
      }
      for (i = bk0; i < blurKernelSize; i++) {
        if (read >= width) {
          break
        }
        var c = argb[read + yi]
        bm = blurMult[i]
        ca += bm[(c & -16777216) >>> 24]
        cr += bm[(c & 16711680) >> 16]
        cg += bm[(c & 65280) >> 8]
        cb += bm[c & 255]
        sum += blurKernel[i]
        read++
      }
      ri = yi + x
      a2[ri] = ca / sum
      r2[ri] = cr / sum
      g2[ri] = cg / sum
      b2[ri] = cb / sum
    }
    yi += width
  }
  yi = 0
  ym = -blurRadius
  ymi = ym * width
  for (y = 0; y < height; y++) {
    for (x = 0; x < width; x++) {
      cb = cg = cr = ca = sum = 0
      if (ym < 0) {
        bk0 = ri = -ym
        read = x
      } else {
        if (ym >= height) {
          break
        }
        bk0 = 0
        ri = ym
        read = x + ymi
      }
      for (i = bk0; i < blurKernelSize; i++) {
        if (ri >= height) {
          break
        }
        bm = blurMult[i]
        ca += bm[a2[read]]
        cr += bm[r2[read]]
        cg += bm[g2[read]]
        cb += bm[b2[read]]
        sum += blurKernel[i]
        ri++
        read += width
      }
      argb[x + yi] =
        ((ca / sum) << 24) | ((cr / sum) << 16) | ((cg / sum) << 8) | (cb / sum)
    }
    yi += width
    ymi += width
    ym++
  }
  _setPixels(pixels, argb)
  //console.log(pixels);
  canvas.context.putImageData(createImageData(pixels, 1440, 1080), 0, 0)
  //console.log(canvas.context)
}

const emojify = (context, emojiImg, foreground = true) => {
  var points = []
  let width = context.canvas.width
  let height = context.canvas.height

  for (let i = 0; i < 70; i++) {
    let x = Math.random() * width
    let y = Math.random() * height
    let s = proportion(80, 200, 0, 1, Math.random())
    if (points.some(p => dist(p.x, p.y, x, y) < p.s + s)) continue
    if (
      foreground &&
      dist(width / 2 - fx, height / 2, x, y - s / 2) +
        dist(width / 2 + fx, height / 2, x, y - s / 2) <
        2.5 * fx
    )
      continue

    points.push({ x, y, s })

    context.save()
    context.translate(x, y)
    if (Math.random() > 0.5) {
      context.scale(-1, 1)
      context.translate(s / 2, 0)
    }

    let angle = (Math.random() - 0.5) * 0.5
    context.rotate(angle)
    //context.filter = "greyscale(100%)"
    context.drawImage(emojiImg, 0 - s / 2, 0 - s / 2, s, s)

    context.restore()
  }
}

app.get("/", async (req, res) => {
  console.log(req.query)

  let blur = Number(req.query.blur)
  if (Number.isNaN(blur) || blur < 0 || blur > 20) blur = 10
  const emoj = req.query.emoji || "👩‍💻"
  const bgColor = "#"+ req.query.bg || "white"

  const canvas = createCanvas(1440, 1080)
  const ctx = canvas.getContext("2d")
  let run = font.layout(emoj)
  let glyph = run.glyphs[0].getImageForSize(160)
  let eImg = await loadImage(glyph.data)

  ctx.fillStyle = bgColor
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  emojify(ctx, eImg, false)
  blurARGB(canvas, blur)
  emojify(ctx, eImg, true)

  res.send('<img src="' + canvas.toDataURL() + '" />')
  console.log("sent")
})
app.listen(port, () => console.log(`Example app listening on port ${port}!`))
