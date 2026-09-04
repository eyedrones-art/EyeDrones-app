const path = require("path");
const fs = require("fs");
const os = require("os");
const crypto = require("crypto");
const { execFileSync } = require("child_process");
const { PNG } = require("pngjs");

// --- palette termiche: array di tappe [posizione 0-1, [r,g,b]] ---
const PALETTE = {
  ironbow: [
    [0.00, [0, 0, 20]], [0.20, [40, 0, 100]], [0.40, [140, 0, 120]],
    [0.60, [220, 60, 20]], [0.80, [255, 170, 0]], [1.00, [255, 255, 200]],
  ],
  rainbow: [
    [0.00, [0, 0, 255]], [0.25, [0, 255, 255]], [0.50, [0, 255, 0]],
    [0.75, [255, 255, 0]], [1.00, [255, 0, 0]],
  ],
  whitehot: [[0.00, [0, 0, 0]], [1.00, [255, 255, 255]]],
  blackhot: [[0.00, [255, 255, 255]], [1.00, [0, 0, 0]]],
  arctic: [
    [0.00, [10, 10, 60]], [0.35, [30, 90, 180]], [0.65, [130, 200, 230]], [1.00, [255, 255, 255]],
  ],
  lava: [
    [0.00, [0, 0, 0]], [0.40, [120, 0, 0]], [0.70, [230, 90, 0]], [1.00, [255, 230, 80]],
  ],
};

function coloreDaPalette(nomePalette, t) {
  const tappe = PALETTE[nomePalette] || PALETTE.ironbow;
  t = Math.max(0, Math.min(1, t));
  for (let i = 0; i < tappe.length - 1; i++) {
    const [p0, c0] = tappe[i];
    const [p1, c1] = tappe[i + 1];
    if (t >= p0 && t <= p1) {
      const f = p1 === p0 ? 0 : (t - p0) / (p1 - p0);
      return [
        Math.round(c0[0] + (c1[0] - c0[0]) * f),
        Math.round(c0[1] +
