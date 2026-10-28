import Phaser from "phaser";
import { getConfig } from "./config";
import { fishingStatus, plotInfo, production } from "./logic";
import { getState, subscribe } from "./store";

export type Selectable =
  | { type: "plot"; index: number }
  | { type: "fishing" }
  | { type: "hive" }
  | { type: "coop" }
  | { type: "market" }
  | { type: "house" };
export type Area = "farm" | "fishing" | "hive" | "coop" | "market";
export interface Bridge {
  onSelect(s: Selectable): void;
}
export interface GameController {
  destroy(): void;
  focus(a: Area): void;
  float(a: Area | number, text: string): void;
  zoom(factor: number): void;
}

const W = 1200;
const H = 900;
const AREAS: Record<Area, { x: number; y: number }> = {
  farm: { x: 592, y: 392 },
  fishing: { x: 300, y: 630 },
  hive: { x: 950, y: 470 },
  coop: { x: 860, y: 700 },
  market: { x: 930, y: 240 },
};
const PLOT0 = { x: 470, y: 270 };
const PS = 72;
const GAP = 14;
const plotPos = (i: number) => ({ x: PLOT0.x + (i % 3) * (PS + GAP), y: PLOT0.y + Math.floor(i / 3) * (PS + GAP) });

// ---------- pixel texture helpers ----------
function pix(sc: Phaser.Scene, key: string, rows: string[], pal: Record<string, number>, s = 4) {
  if (sc.textures.exists(key)) return;
  const g = sc.add.graphics();
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = pal[row[x]];
      if (c === undefined) continue;
      g.fillStyle(c, 1);
      g.fillRect(x * s, y * s, s, s);
    }
  });
  g.generateTexture(key, rows[0].length * s, rows.length * s);
  g.destroy();
}
type R = (x: number, y: number, w: number, h: number, c: number) => void;
function draw(sc: Phaser.Scene, key: string, w: number, h: number, fn: (r: R) => void, s = 4) {
  if (sc.textures.exists(key)) return;
  const g = sc.add.graphics();
  fn((x, y, ww, hh, c) => {
    g.fillStyle(c, 1);
    g.fillRect(x * s, y * s, ww * s, hh * s);
  });
  g.generateTexture(key, w * s, h * s);
  g.destroy();
}

function makeTextures(sc: Phaser.Scene) {
  pix(sc, "water", ["BBBBBBBB", "BBBbBBBB", "BBbwbBBB", "BBBBBBBB", "BBBBBBBB", "BBBBBBbB", "BBBBBbwb", "BBBBBBBB"], { B: 0x2a86c8, b: 0x3a9ad8, w: 0x8ad0f0 });
  pix(sc, "waves", ["........", "..w.....", ".w.w....", "........", "........", ".....w..", "....w.w.", "........"], { w: 0xd8f2ff });
  pix(sc, "tree", [
    "....DDDD....", "..DDGGGGDD..", ".DGGLLGGGGD.", ".DGLLGGGGGD.", "DGGGGGGLGGGD", "DGGGGGLLGGGD",
    "DGGLGGGGGGGD", ".DGGGGGGGGD.", ".DDGGGGGGDD.", "..DDDGGDDD..", ".....TT.....", ".....TT.....", "....TTTT....", "...SSSSSS...",
  ], { D: 0x2f7d3a, G: 0x47a848, L: 0x7ad35e, T: 0x7a4a2a, S: 0x3d8a3a });
  pix(sc, "rock", ["..kkkk..", ".kkKKKk.", "kkKKKKKd", "kKKKKKdd", "KKKKKddd", ".dddddd."], { K: 0x8a8f96, k: 0xc0c6cc, d: 0x5a5f66 });
  pix(sc, "bush", ["..GGGG..", ".GLLGGG.", "GGLGGGGG", "GGGGGGRG", "DGGRGGGD", ".DDDDDD."], { G: 0x47a848, L: 0x7ad35e, D: 0x2f7d3a, R: 0xe8384a });
  const flower = (k: string, p: number) =>
    pix(sc, k, [".P.P.", "PPYPP", ".PPP.", "..G..", ".GG..", "..G.."], { P: p, Y: 0xffd23a, G: 0x2f7d3a }, 3);
  flower("flowerR", 0xe8384a);
  flower("flowerW", 0xffffff);
  flower("flowerB", 0x6aa8f0);
  pix(sc, "bee", [".WW..", "YKYKY", "YKYKY", ".K.K."], { Y: 0xffd23a, K: 0x2a2a2a, W: 0xeaf6ff }, 3);
  pix(sc, "chickA", ["..RR....", ".WWW....", ".WKW..W.", "OWWWWWWW", "..WWWWww", "..WWWWw.", "...O.O..", "...O.O.."], { W: 0xffffff, w: 0xd8d8d8, R: 0xe03a3a, O: 0xf0a020, K: 0x222222 });
  pix(sc, "chickB", ["........", "......W.", "..WWWWWW", ".RWWWWww", "RWKWWWw.", "OWWW....", "...O.O..", "...O.O.."], { W: 0xffffff, w: 0xd8d8d8, R: 0xe03a3a, O: 0xf0a020, K: 0x222222 });
  pix(sc, "egg", [".EE.", "EEEE", "EEEe", "EEee", ".ee."], { E: 0xfff4dc, e: 0xe8d4b0 }, 3);
  pix(sc, "fence", [".FF..FF.", "FFFFFFFF", ".FF..FF.", ".FF..FF.", "FFFFFFFF", ".FF..FF.", ".FF..FF.", ".ff..ff."], { F: 0xb07a44, f: 0x7a4a2a });
  pix(sc, "lock", ["..KKK..", ".K...K.", ".K...K.", "GGGGGGG", "GGGKGGG", "GGGKGGG", "GGGGGGG"], { K: 0x5a5f66, G: 0xf2c94c }, 4);
  pix(sc, "spark", ["..W..", ".WYW.", "WYYYW", ".WYW.", "..W.."], { W: 0xffffff, Y: 0xffe14a }, 3);
  pix(sc, "bobber", [".RR.", "RRRR", "WWWW", ".WW."], { R: 0xe8384a, W: 0xffffff }, 3);
  pix(sc, "fishA", ["..SS....", ".SSSSS..", "SSSSSSS.", ".SSSSS..", "..SS...."], { S: 0xf2c94c }, 3);
  pix(sc, "fishB", ["..BB....", ".BBBBB..", "BBBBBBB.", ".BBBBB..", "..BB...."], { B: 0xffa45c }, 3);
  pix(sc, "fisher", ["...HH...", "..HHHH..", "...SS...", "..SSSS..", ".SSSSSS.", "...PP...", "...PP...", "..P..P.."], { H: 0x5a3424, S: 0xf2c94c, P: 0x345d9d }, 4);
  pix(sc, "alert", [".YY.", ".YY.", ".YY.", "....", ".YY."], { Y: 0xffe14a }, 4);
  pix(sc, "lily", [".GG.G", "GGGGG", "GGLGG", ".GGG."], { G: 0x3d9a4a, L: 0x6fcf5a }, 4);
  pix(sc, "tuft", ["G.G.G", ".GGG."], { G: 0x4a9e48 }, 3);

  draw(sc, "soil", 18, 18, (r) => {
    r(0, 0, 18, 18, 0x5a3a20);
    r(1, 1, 16, 16, 0x8a5a32);
    for (let y = 3; y < 17; y += 5) r(2, y, 14, 1, 0x6e4426);
    r(1, 1, 16, 1, 0xa06a3c);
  });
  draw(sc, "house", 40, 36, (r) => {
    r(3, 14, 34, 20, 0xd8c49a);
    r(4, 15, 32, 19, 0xf3e3c0);
    for (let x = 4; x < 36; x += 8) r(x, 15, 1, 19, 0xe2cfa4);
    for (let k = 0; k < 14; k++) {
      const half = Math.floor(6 + k * 1.05);
      r(20 - half, k, half * 2, 1, k % 3 === 0 ? 0xa0362c : 0xc8483a);
    }
    r(28, 1, 4, 7, 0x8a5a3a);
    r(27, 0, 6, 1, 0x6a4a2a);
    r(17, 22, 6, 12, 0x7a4a2a);
    r(18, 23, 4, 11, 0x9a6a3a);
    r(21, 28, 1, 1, 0xf2c94c);
    for (const wx of [7, 27]) {
      r(wx, 18, 7, 7, 0x7a4a2a);
      r(wx + 1, 19, 5, 5, 0x8ad0f0);
      r(wx + 3, 19, 1, 5, 0x7a4a2a);
      r(wx, 25, 7, 1, 0xb07a44);
    }
    r(2, 34, 36, 2, 0x8a6a4a);
  });
  draw(sc, "market", 36, 30, (r) => {
    for (let x = 0; x < 36; x += 4) r(x, 0, 4, 7, (x / 4) % 2 === 0 ? 0xe8484a : 0xfff4dc);
    r(0, 7, 36, 1, 0xa0362c);
    r(2, 8, 2, 20, 0x7a4a2a);
    r(32, 8, 2, 20, 0x7a4a2a);
    r(1, 18, 34, 10, 0xb07a44);
    r(1, 18, 34, 1, 0xd89a5a);
    for (let x = 3; x < 33; x += 6) {
      r(x, 15, 5, 3, 0x9a6a3a);
      r(x + 1, 13, 1, 2, [0xf2c94c, 0xf07a2a, 0xe8384a, 0x2f9e44, 0xffb81a][(x / 6) | 0]);
      r(x + 3, 14, 1, 1, [0xf2c94c, 0xf07a2a, 0xe8384a, 0x2f9e44, 0xffb81a][(x / 6) | 0]);
    }
    r(12, 21, 12, 4, 0xfff4dc);
    r(13, 22, 10, 2, 0xf2c94c);
    r(0, 28, 36, 2, 0x5a3a20);
  });
  draw(sc, "coop", 30, 26, (r) => {
    for (let k = 0; k < 9; k++) r(15 - (5 + k), k, (5 + k) * 2, 1, k % 2 ? 0x9a5a2a : 0x7a4a2a);
    r(2, 9, 26, 15, 0xd89a5a);
    for (let y = 11; y < 24; y += 3) r(2, y, 26, 1, 0xb07a44);
    r(11, 14, 8, 10, 0x3a2414);
    r(5, 11, 4, 4, 0xfff4dc);
    r(21, 11, 4, 4, 0xfff4dc);
    r(9, 24, 12, 2, 0xb07a44);
  });
  draw(sc, "hive", 14, 18, (r) => {
    r(1, 0, 12, 2, 0xb07a44);
    for (let y = 2; y < 14; y += 4) {
      r(0, y, 14, 4, 0xf2c040);
      r(0, y + 3, 14, 1, 0xd89a20);
    }
    r(5, 11, 4, 2, 0x3a2414);
    r(2, 14, 2, 4, 0x7a4a2a);
    r(10, 14, 2, 4, 0x7a4a2a);
  });
}

class FarmScene extends Phaser.Scene {
  bridge: Bridge;
  moved = false;
  down: { x: number; y: number; sx: number; sy: number } | null = null;
  water!: Phaser.GameObjects.TileSprite;
  waves!: Phaser.GameObjects.TileSprite;
  plots: { crop: Phaser.GameObjects.Graphics; bar: Phaser.GameObjects.Graphics; lock: Phaser.GameObjects.Container; spark: Phaser.GameObjects.Image; key: string }[] = [];
  bees: { s: Phaser.GameObjects.Image; a: number; r: number; sp: number }[] = [];
  bobber!: Phaser.GameObjects.Image;
  line!: Phaser.GameObjects.Graphics;
  alert!: Phaser.GameObjects.Image;
  honeyBar!: Phaser.GameObjects.Graphics;
  eggs: Phaser.GameObjects.Image[] = [];
  swimmingFish: { s: Phaser.GameObjects.Image; x: number; y: number; range: number; speed: number; phase: number }[] = [];\n  fisherman!: Phaser.GameObjects.Image;
  dirty = true;
  unsub: () => void = () => {};

  constructor(bridge: Bridge) {
    super("farm");
    this.bridge = bridge;
  }

  create() {
    makeTextures(this);
    this.water = this.add.tileSprite(0, 0, W, H, "water").setOrigin(0);
    this.waves = this.add.tileSprite(0, 0, W, H, "waves").setOrigin(0).setAlpha(0.5);
    this.drawIsland();
    this.drawPaths();
    this.drawPond();
    this.drawFarm();
    this.drawBuildings();
    this.drawDecor();
    this.setupCamera();
    this.setupInput();
    this.unsub = subscribe(() => (this.dirty = true));
    this.events.once("shutdown", () => this.unsub());
    this.events.once("destroy", () => this.unsub());
    this.time.addEvent({ delay: 250, loop: true, callback: () => this.refresh() });
    this.refresh();
  }

  zone(x: number, y: number, w: number, h: number, sel: Selectable, target?: Phaser.GameObjects.Image) {
    const z = this.add.zone(x, y, w, h).setInteractive({ useHandCursor: true });
    z.on("pointerup", () => {
      if (!this.moved) this.bridge.onSelect(sel);
    });
    if (target) {
      z.on("pointerover", () => target.setTint(0xfff2c8));
      z.on("pointerout", () => target.clearTint());
    }
    return z;
  }

  drawIsland() {
    const g = this.add.graphics();
    g.fillStyle(0xbfe8f5, 0.5);
    g.fillRoundedRect(76, 56, 1048, 818, 110);
    g.fillStyle(0xe8d19a, 1);
    g.fillRoundedRect(90, 70, 1020, 790, 96);
    g.fillStyle(0xd4b878, 1);
    g.fillRoundedRect(90, 840, 1020, 20, { tl: 0, tr: 0, bl: 96, br: 96 });
    g.fillStyle(0x4ea84c, 1);
    g.fillRoundedRect(108, 86, 984, 744, 84);
    g.fillStyle(0x5cb85a, 1);
    g.fillRoundedRect(112, 86, 976, 736, 82);
    const foam = this.add.graphics();
    foam.lineStyle(4, 0xffffff, 0.7);
    foam.strokeRoundedRect(82, 62, 1036, 806, 104);
    this.tweens.add({ targets: foam, alpha: 0.2, duration: 1600, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    for (let y = 120; y < 800; y += 36) {
      for (let x = 150; x < 1060; x += 44) {
        const h = (x * 73 + y * 37) % 11;
        if (h < 3) this.add.image(x + (h * 7) % 20, y + (h * 5) % 16, "tuft").setAlpha(0.8);
      }
    }
  }

  drawPaths() {
    const g = this.add.graphics();
    const path = (x: number, y: number, w: number, h: number) => {
      g.fillStyle(0xc89a5a, 1);
      g.fillRect(x - 2, y - 2, w + 4, h + 4);
      g.fillStyle(0xe0b878, 1);
      g.fillRect(x, y, w, h);
    };
    path(240, 300, 32, 270);
    path(240, 552, 780, 32);
    path(576, 530, 32, 30);
    path(916, 290, 32, 270);
    path(780, 580, 32, 60);
    path(400, 580, 32, 40);
  }

  drawPond() {
    const g = this.add.graphics();
    g.fillStyle(0x8a8f96, 1);
    g.fillEllipse(290, 650, 316, 196);
    g.fillStyle(0x2a9ab8, 1);
    g.fillEllipse(290, 650, 300, 180);
    g.fillStyle(0x4fc0d8, 1);
    g.fillEllipse(282, 642, 250, 140);
    const ripple = this.add.graphics();
    ripple.lineStyle(3, 0xbff0ff, 0.6);
    ripple.strokeEllipse(240, 660, 60, 22);
    ripple.strokeEllipse(330, 620, 40, 14);
    this.tweens.add({ targets: ripple, alpha: 0.1, duration: 1400, yoyo: true, repeat: -1 });
    this.add.image(190, 610, "lily");
    this.add.image(220, 710, "lily").setScale(0.8);
    this.add.image(360, 700, "lily");
    // dock
    const d = this.add.graphics();
    d.fillStyle(0x5a3a20, 1);
    d.fillRect(312, 604, 132, 36);
    d.fillStyle(0xb07a44, 1);
    for (let x = 316; x < 440; x += 14) d.fillRect(x, 606, 12, 32);
    d.fillStyle(0x7a4a2a, 1);
    [316, 380, 432].forEach((x) => d.fillRect(x, 638, 8, 14));
    this.line = this.add.graphics();
    this.bobber = this.add.image(230, 650, "bobber").setVisible(false);
    this.alert = this.add.image(230, 615, "alert").setVisible(false);
    this.tweens.add({ targets: this.alert, y: 605, duration: 300, yoyo: true, repeat: -1 });
    this.zone(300, 640, 320, 200, { type: "fishing" });
  }

  drawFarm() {
    for (let x = 446; x < 750; x += 32) {
      this.add.image(x + 16, 248, "fence");
      if (x < 560 || x > 610) this.add.image(x + 16, 540, "fence");
    }
    for (let y = 280; y < 540; y += 32) {
      this.add.image(446, y, "fence").setAngle(90);
      this.add.image(738, y, "fence").setAngle(90);
    }
    getConfig().plots.forEach((_, i) => {
      const { x, y } = plotPos(i);
      this.add.image(x, y, "soil").setOrigin(0);
      const crop = this.add.graphics();
      const bar = this.add.graphics();
      const lock = this.add.container(x + PS / 2, y + PS / 2);
      const shade = this.add.rectangle(0, 0, PS, PS, 0x2a4a2a, 0.55);
      const icon = this.add.image(0, -8, "lock");
      const label = this.add.text(0, 18, "", { fontFamily: "Pixelify Sans, monospace", fontSize: "13px", color: "#fff4dc", stroke: "#3a2414", strokeThickness: 3 }).setOrigin(0.5).setResolution(2);
      lock.add([shade, icon, label]);
      const spark = this.add.image(x + PS - 8, y + 6, "spark").setVisible(false);
      this.tweens.add({ targets: spark, scale: 1.4, duration: 500, yoyo: true, repeat: -1 });
      this.plots.push({ crop, bar, lock, spark, key: "" });
      this.zone(x + PS / 2, y + PS / 2, PS + 8, PS + 8, { type: "plot", index: i });
    });
  }

  drawBuildings() {
    const house = this.add.image(260, 302, "house").setOrigin(0.5, 1);
    this.zone(260, 230, 160, 144, { type: "house" }, house);
    const market = this.add.image(932, 300, "market").setOrigin(0.5, 1);
    this.zone(932, 240, 144, 120, { type: "market" }, market);
    // hive
    const hive = this.add.image(952, 500, "hive").setOrigin(0.5, 1);
    this.honeyBar = this.add.graphics();
    for (let i = 0; i < 6; i++) {
      const s = this.add.image(952, 450, "bee");
      this.bees.push({ s, a: i * 1.1, r: 30 + (i % 3) * 14, sp: 0.0016 + i * 0.0003 });
    }
    this.zone(952, 470, 100, 110, { type: "hive" }, hive);
    // coop & pen
    const coop = this.add.image(790, 752, "coop").setOrigin(0.5, 1);
    for (let x = 860; x < 1040; x += 32) {
      this.add.image(x + 16, 630, "fence");
      this.add.image(x + 16, 790, "fence");
    }
    for (let y = 662; y < 790; y += 32) this.add.image(1046, y, "fence").setAngle(90);
    for (let i = 0; i < 6; i++) this.eggs.push(this.add.image(752 + (i % 3) * 14, 766 + Math.floor(i / 3) * 12, "egg").setVisible(false));
    for (let i = 0; i < 4; i++) this.spawnChicken(890 + i * 36, 690 + (i % 2) * 40);
    this.zone(880, 705, 330, 180, { type: "coop" }, coop);
  }

  spawnChicken(x: number, y: number) {
    const c = this.add.image(x, y, "chickA");
    const act = () => {
      if (!c.active) return;
      if (Math.random() < 0.55) {
        const nx = Phaser.Math.Between(880, 1020);
        const ny = Phaser.Math.Between(660, 770);
        c.setFlipX(nx > c.x);
        this.tweens.add({ targets: c, x: nx, y: ny, duration: Phaser.Math.Between(900, 2200), onComplete: () => this.time.delayedCall(Phaser.Math.Between(300, 1500), act) });
      } else {
        let n = 0;
        this.time.addEvent({ delay: 180, repeat: 5, callback: () => c.setTexture(++n % 2 ? "chickB" : "chickA") });
        this.time.delayedCall(1300, act);
      }
    };
    this.time.delayedCall(Phaser.Math.Between(0, 1200), act);
  }

  drawDecor() {
    const trees = [[150, 150], [400, 120], [690, 115], [800, 130], [1060, 140], [1070, 360], [1075, 560], [140, 420], [470, 770], [600, 800], [1080, 820], [150, 800], [690, 690]];
    trees.forEach(([x, y]) => this.add.image(x, y, "tree").setOrigin(0.5, 1).setDepth(y));
    [[360, 300], [770, 300], [1050, 470], [520, 650], [140, 560]].forEach(([x, y]) => this.add.image(x, y, "rock"));
    [[370, 420], [800, 420], [700, 640], [1000, 340]].forEach(([x, y]) => this.add.image(x, y, "bush"));
    const fl = ["flowerR", "flowerW", "flowerB"];
    [[900, 520], [1010, 500], [990, 440], [890, 430], [340, 200], [180, 320], [380, 520], [760, 220], [520, 220], [640, 220], [1030, 280], [460, 600]].forEach(([x, y], i) =>
      this.add.image(x, y, fl[i % 3]),
    );
  }

  setupCamera() {
    const cam = this.cameras.main;
    cam.setBounds(0, 0, W, H);
    cam.setRoundPixels(true);
    const layout = () => {
      const w = this.scale.width;
      const h = this.scale.height;
      const fit = Math.min(w / W, h / H);
      const zoom = fit >= 0.6 ? fit : Math.max(fit, Math.min(w, h) / 640);
      cam.setZoom(zoom);
    };
    layout();
    cam.centerOn(AREAS.farm.x, H / 2);
    this.scale.on("resize", layout);
  }

  setupInput() {
    const cam = this.cameras.main;
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      this.down = { x: p.x, y: p.y, sx: cam.scrollX, sy: cam.scrollY };
      this.moved = false;
    });
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (!this.down || !p.isDown) return;
      const dx = p.x - this.down.x;
      const dy = p.y - this.down.y;
      if (Math.abs(dx) + Math.abs(dy) > 10) this.moved = true;
      if (this.moved) {
        cam.scrollX = this.down.sx - dx / cam.zoom;
        cam.scrollY = this.down.sy - dy / cam.zoom;
      }
    });
    this.input.on("pointerup", () => (this.down = null));
  }

  drawCrop(g: Phaser.GameObjects.Graphics, x: number, y: number, stage: number, color: number) {
    g.clear();
    const s = 4;
    const r = (px: number, py: number, w: number, h: number, c: number) => {
      g.fillStyle(c, 1);
      g.fillRect(x + px * s, y + py * s, w * s, h * s);
    };
    for (let i = 0; i < 9; i++) {
      const bx = 2 + (i % 3) * 5;
      const by = 4 + Math.floor(i / 3) * 5;
      if (stage === 0) r(bx + 1, by + 1, 2, 1, 0x3a2414);
      if (stage >= 1) {
        r(bx + 1, by - 1, 1, 3, 0x2f7d3a);
        r(bx, by - 1, 1, 1, 0x6fcf5a);
        r(bx + 2, by - 2, 1, 1, 0x6fcf5a);
      }
      if (stage >= 2) {
        r(bx, by - 2, 3, 2, 0x47a848);
        r(bx + 1, by - 3, 1, 1, 0x7ad35e);
      }
      if (stage >= 3) {
        r(bx, by - 3, 3, 2, color);
        r(bx, by - 3, 1, 1, 0xffffff);
      }
    }
  }

  refresh() {
    const s = getState();
    const now = Date.now();
    const cfg = getConfig();
    this.plots.forEach((v, i) => {
      const { x, y } = plotPos(i);
      const unlocked = s.unlocked[i];
      v.lock.setVisible(!unlocked);
      if (!unlocked) {
        const req = cfg.plots[i];
        (v.lock.list[2] as Phaser.GameObjects.Text).setText(`Lv${req.level} · $${req.cost}`);
      }
      const info = plotInfo(s.plots[i], now);
      const key = info.state === "empty" ? "e" : `${info.cropId}-${info.stage}`;
      if (key !== v.key || this.dirty) {
        v.key = key;
        if (info.state === "empty") v.crop.clear();
        else this.drawCrop(v.crop, x, y, info.stage, cfg.crops.find((c) => c.id === info.cropId)?.color ?? 0xffffff);
      }
      v.bar.clear();
      v.spark.setVisible(info.state === "ready");
      if (info.state === "growing") {
        v.bar.fillStyle(0x3a2414, 1).fillRect(x + 4, y - 10, PS - 8, 8);
        v.bar.fillStyle(0xf2c94c, 1).fillRect(x + 6, y - 8, (PS - 12) * info.pct, 4);
      }
    });
    // fishing
    const fs = fishingStatus(s, now);
    const active = fs === "waiting" || fs === "ready";
    this.bobber.setVisible(active);
    this.alert.setVisible(fs === "ready");
    this.line.clear();
    if (active) {
      this.line.lineStyle(2, 0xffffff, 0.8);
      this.line.lineBetween(316, 590, this.bobber.x, this.bobber.y);
      this.line.fillStyle(0x7a4a2a, 1).fillRect(312, 586, 22, 4);
    }
    // hive
    const hp = production("hive", s, now);
    const pct = hp.amount.div(hp.capacity).toNumber();
    this.honeyBar.clear();
    this.honeyBar.fillStyle(0x3a2414, 1).fillRect(922, 418, 60, 10);
    this.honeyBar.fillStyle(pct >= 1 ? 0xffb81a : 0xf2c040, 1).fillRect(924, 420, 56 * pct, 6);
    // eggs
    const cp = production("coop", s, now);
    const n = Math.min(6, cp.amount.floor().toNumber());
    this.eggs.forEach((e, i) => e.setVisible(i < n));
    this.dirty = false;
  }

  update(time: number) {
    this.water.tilePositionX += 0.15;
    this.waves.tilePositionX -= 0.3;
    this.waves.tilePositionY = Math.sin(time / 1200) * 6;
    this.bees.forEach((b) => {
      const a = b.a + time * b.sp;
      b.s.setPosition(952 + Math.cos(a) * b.r, 455 + Math.sin(a * 1.7) * b.r * 0.5);
      b.s.setFlipX(Math.sin(a) > 0);
    });
    if (this.bobber.visible) this.bobber.y = 650 + Math.sin(time / (this.alert.visible ? 90 : 400)) * (this.alert.visible ? 4 : 2);
  }

  zoom(factor: number) {
    const cam = this.cameras.main;
    cam.setZoom(Phaser.Math.Clamp(cam.zoom * factor, 0.3, 2.2));
  }

  focus(a: Area) {
    const p = AREAS[a];
    this.cameras.main.pan(p.x, p.y, 500, "Sine.easeInOut");
  }

  float(a: Area | number, text: string) {
    const p = typeof a === "number" ? { x: plotPos(a).x + PS / 2, y: plotPos(a).y } : AREAS[a];
    const t = this.add
      .text(p.x, p.y, text, { fontFamily: "Pixelify Sans, monospace", fontSize: "22px", color: "#ffe14a", stroke: "#3a2414", strokeThickness: 5 })
      .setOrigin(0.5)
      .setResolution(2)
      .setDepth(5000);
    this.tweens.add({ targets: t, y: p.y - 60, alpha: 0, duration: 1300, ease: "Cubic.easeOut", onComplete: () => t.destroy() });
  }
}

export function createGame(parent: HTMLElement, bridge: Bridge): GameController {
  const scene = new FarmScene(bridge);
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: "#2a86c8",
    pixelArt: true,
    banner: false,
    scale: { mode: Phaser.Scale.RESIZE, width: parent.clientWidth, height: parent.clientHeight },
    scene: [scene],
  });
  const ready = () => scene.sys?.isActive?.();
  return {
    destroy: () => game.destroy(true),
    focus: (a) => ready() && scene.focus(a),
    float: (a, t) => ready() && scene.float(a, t),
    zoom: (factor) => ready() && scene.zoom(factor),
  };
}
