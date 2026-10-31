// App Store screenshots: a short caption above a real screenshot in a plain phone body, 1320 x 2868 (6.9-inch).
// Reads the raw screens from appstore/screenshots/raw (made by scripts/shots.js), writes appstore/screenshots/01-...png.
// Usage: node scripts/appstore.js
"use strict";
const path = require("path"), fs = require("fs");
const { chromium } = require("playwright");
const root = path.join(__dirname, ".."), raw = path.join(root, "appstore", "screenshots", "raw"), out = path.join(root, "appstore", "screenshots");

const PLUM = { bg: "#3B2240", head: "#F1E9D8", sub: "#BBA7BE" };
const PIST = { bg: "#B9C9A3", head: "#2A1E2E", sub: "#3E4830" };
const slides = [
  ["01-one-thought", "meet-light", PLUM, "One thought at a time.", "Write down what's on your mind. Scales hands it back later."],
  ["02-sets", "sets", PIST, "Start with lines worth keeping.", "Five sets, from the Stoics to Franklin, in plain English."],
  ["03-two-moves", "pull", PLUM, "Two moves. That's all.", "Swipe up to move on. Pull down to put it away."],
  ["04-write", "write", PIST, "One sentence is enough.", "Tap New and write what's on your mind."],
  ["05-bolder", "meet-own", PLUM, "Glance past, and it comes back bolder.", "Linger, and it rests longer."],
  ["06-your-thoughts", "library", PIST, "Nothing disappears on its own.", "See every thought, and when it comes back."],
  ["07-yours", "meet-dark", PIST, "Yours, on your phone.", "No account. Nothing leaves your phone. Light or Dark."]
];

const font = "data:font/woff2;base64," + fs.readFileSync(path.join(root, "site", "fonts", "geist-latin.woff2")).toString("base64");

(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1320, height: 2868 }, deviceScaleFactor: 1 })).newPage();
  for (const [name, shot, c, head, sub] of slides) {
    const src = "data:image/png;base64," + fs.readFileSync(path.join(raw, shot + ".png")).toString("base64");
    await p.setContent(`<html><head><style>
      @font-face { font-family: Geist; src: url(${font}) format("woff2"); font-weight: 100 900; }
      html, body { margin: 0; width: 1320px; height: 2868px; overflow: hidden; background: ${c.bg}; font-family: Geist, sans-serif; -webkit-font-smoothing: antialiased; }
      .cap { position: absolute; left: 90px; right: 90px; top: 0; height: 700px; display: flex; flex-direction: column; justify-content: center; text-align: center; }
      h1 { margin: 0; font-size: 104px; line-height: 1.06; font-weight: 700; letter-spacing: -0.03em; color: ${c.head}; text-wrap: balance; }
      p { margin: 34px auto 0; max-width: 1000px; font-size: 48px; line-height: 1.3; font-weight: 450; letter-spacing: -0.01em; color: ${c.sub}; text-wrap: balance; }
      .ph { position: absolute; left: 50%; top: 720px; width: 1060px; height: 2234px; margin-left: -530px; box-sizing: border-box;
        border-radius: 164px; padding: 29px;
        background: linear-gradient(145deg, #3a3440, #151217 40%, #262129);
        box-shadow: inset 0 0 0 3px rgba(255,255,255,.16), inset 0 0 0 10px #0d0b0f, 0 40px 90px rgba(20,10,24,.35); }
      .ph img { width: 1002px; height: 2176px; border-radius: 135px; display: block; }
    </style></head><body>
      <div class="cap"><h1>${head}</h1><p>${sub}</p></div>
      <div class="ph"><img src="${src}"></div>
    </body></html>`);
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(150);
    await p.screenshot({ path: path.join(out, name + ".png") });
    console.log("saved " + name + ".png");
  }
  await b.close();
})();
