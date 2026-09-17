import type { Mood } from "./mood";

// Boca como curva cuadrática (v0, control, v1), igual que en Face.svelte,
// convertida a tangentes cúbicas relativas para Lottie (bodymovin).
const MOUTHS: Record<Mood, { v0: [number, number]; c: [number, number]; v1: [number, number] }> = {
  muy_satisfecho: { v0: [-30, 12], c: [0, 42], v1: [30, 12] },
  satisfecho: { v0: [-26, 10], c: [0, 28], v1: [26, 10] },
  regular: { v0: [-24, 16], c: [0, 16], v1: [24, 16] }, // control = punto medio -> línea recta
  poco_satisfecho: { v0: [-26, 28], c: [0, 12], v1: [26, 28] },
  insatisfecho: { v0: [-32, 34], c: [0, 6], v1: [32, 34] },
};

// Paleta NOVA reducida a azul/naranja/neutro (sin verde ni rojo).
const COLORS: Record<Mood, [number, number, number]> = {
  muy_satisfecho: hexToRgb("#2454C6"),
  satisfecho: hexToRgb("#5B7FE5"),
  regular: hexToRgb("#667085"),
  poco_satisfecho: hexToRgb("#F59A45"),
  insatisfecho: hexToRgb("#E47704"),
};

const INK: [number, number, number] = hexToRgb("#101828");

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function scaleVec(v: [number, number], f: number): [number, number] {
  return [v[0] * f, v[1] * f];
}

function sub(a: [number, number], b: [number, number]): [number, number] {
  return [a[0] - b[0], a[1] - b[1]];
}

// Bodymovin exige easing temporal ("i"/"o") en todo keyframe que no sea el
// último de una propiedad animada ("a":1); sin esto, lottie-web no logra
// interpolar y termina empujando la capa fuera de pantalla. Este helper
// arma keyframes lineales válidos para propiedades de N dimensiones.
function kf(t: number, s: number[], isLast = false) {
  if (isLast) return { t, s };
  const ones = s.map(() => 1);
  const zeros = s.map(() => 0);
  return { t, s, i: { x: ones, y: ones }, o: { x: zeros, y: zeros } };
}

// Genera una animación bodymovin (Lottie) autocontenida: un grupo con la cara,
// los ojos (parpadeo) y la boca, más un rebote/balanceo del conjunto. Se
// construye en código en vez de bajar assets de internet para que el kiosko
// pueda votar sin conexión y no dependa de licencias de terceros.
export function buildFaceAnimation(mood: Mood) {
  const { v0, c, v1 } = MOUTHS[mood];
  const out0 = scaleVec(sub(c, v0), 2 / 3);
  const in1 = scaleVec(sub(c, v1), 2 / 3);
  const [r, g, b] = COLORS[mood];
  const [ir, ig, ib] = INK;

  return {
    v: "5.9.0",
    fr: 30,
    ip: 0,
    op: 90,
    w: 100,
    h: 100,
    nm: "face",
    ddd: 0,
    assets: [],
    layers: [
      {
        ddd: 0,
        ind: 1,
        ty: 4,
        nm: "face",
        sr: 1,
        ks: {
          o: { a: 0, k: 100 },
          r: {
            a: 1,
            k: [kf(0, [0]), kf(45, [-6]), kf(90, [0], true)],
          },
          p: {
            a: 1,
            k: [kf(0, [50, 50, 0]), kf(45, [50, 45, 0]), kf(90, [50, 50, 0], true)],
          },
          a: { a: 0, k: [0, 0, 0] },
          s: { a: 0, k: [100, 100, 100] },
        },
        ao: 0,
        shapes: [
          {
            ty: "gr",
            nm: "eyes",
            it: [
              { ty: "el", p: { a: 0, k: [-16, -8] }, s: { a: 0, k: [12, 12] } },
              { ty: "el", p: { a: 0, k: [16, -8] }, s: { a: 0, k: [12, 12] } },
              { ty: "fl", c: { a: 0, k: [ir, ig, ib, 1] }, o: { a: 0, k: 100 } },
              {
                ty: "tr",
                p: { a: 0, k: [0, 0] },
                a: { a: 0, k: [0, -8] },
                s: {
                  a: 1,
                  k: [
                    kf(0, [100, 100]),
                    kf(82, [100, 100]),
                    kf(86, [100, 10]),
                    kf(90, [100, 100], true),
                  ],
                },
                r: { a: 0, k: 0 },
                o: { a: 0, k: 100 },
              },
            ],
          },
          {
            ty: "gr",
            nm: "mouth",
            it: [
              {
                ty: "sh",
                ks: {
                  a: 0,
                  k: {
                    i: [
                      [0, 0],
                      in1,
                    ],
                    o: [out0, [0, 0]],
                    v: [v0, v1],
                    c: false,
                  },
                },
              },
              {
                ty: "st",
                c: { a: 0, k: [ir, ig, ib, 1] },
                w: { a: 0, k: 6 },
                o: { a: 0, k: 100 },
                lc: 2,
                lj: 2,
              },
              {
                ty: "tr",
                p: { a: 0, k: [0, 0] },
                a: { a: 0, k: [0, 0] },
                s: { a: 0, k: [100, 100] },
                r: { a: 0, k: 0 },
                o: { a: 0, k: 100 },
              },
            ],
          },
          {
            ty: "gr",
            nm: "faceCircle",
            it: [
              { ty: "el", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [92, 92] } },
              { ty: "fl", c: { a: 0, k: [r, g, b, 1] }, o: { a: 0, k: 100 } },
              {
                ty: "tr",
                p: { a: 0, k: [0, 0] },
                a: { a: 0, k: [0, 0] },
                s: { a: 0, k: [100, 100] },
                r: { a: 0, k: 0 },
                o: { a: 0, k: 100 },
              },
            ],
          },
        ],
        ip: 0,
        op: 90,
        st: 0,
        bm: 0,
      },
    ],
  };
}
