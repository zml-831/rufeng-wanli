/**
 * 原创 SVG 场景与纹样。
 * 设计取意：孔庙棂星门、大成殿、斗拱、回纹、云纹、松柏、纸鸢。
 * 均为装饰性再创作，不对应具体文物测绘。
 */

export function heroScene() {
  const pineNeedles = (cx, cy, r, n = 9) =>
    Array.from({ length: n }, (_, i) => {
      const a = (Math.PI * 2 * i) / n;
      return `<path d="M${cx} ${cy} l${(Math.cos(a) * r).toFixed(1)} ${(Math.sin(a) * r).toFixed(1)}" />`;
    }).join('');

  const roofTiles = (x1, x2, y, count) =>
    Array.from({ length: count }, (_, i) => {
      const x = x1 + ((x2 - x1) * (i + 0.5)) / count;
      return `<path d="M${x.toFixed(1)} ${y} v${(16 + (i % 3) * 2).toFixed(1)}" />`;
    }).join('');

  return `<svg class="hero-landscape" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
    <defs>
      <radialGradient id="moonFill" cx="38%" cy="34%" r="72%">
        <stop offset="0" stop-color="#f2dfb6" stop-opacity=".86"/>
        <stop offset=".62" stop-color="#d8b36e" stop-opacity=".42"/>
        <stop offset="1" stop-color="#a77a38" stop-opacity=".08"/>
      </radialGradient>
      <linearGradient id="mountFar" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#2d241d" stop-opacity=".7"/>
        <stop offset="1" stop-color="#171311" stop-opacity="1"/>
      </linearGradient>
      <linearGradient id="mountNear" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#221b16" stop-opacity=".85"/>
        <stop offset="1" stop-color="#120f0d" stop-opacity="1"/>
      </linearGradient>
      <linearGradient id="gateFill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#2e231b" stop-opacity=".8"/>
        <stop offset="1" stop-color="#171210" stop-opacity=".96"/>
      </linearGradient>
      <linearGradient id="goldLine" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#d8b36e" stop-opacity="0"/>
        <stop offset=".3" stop-color="#d8b36e" stop-opacity=".42"/>
        <stop offset=".7" stop-color="#d8b36e" stop-opacity=".3"/>
        <stop offset="1" stop-color="#d8b36e" stop-opacity="0"/>
      </linearGradient>
      <filter id="moonGlow" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="28"/>
      </filter>
      <filter id="softBlur" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="4"/>
      </filter>
    </defs>

    <g opacity=".74">
      <circle cx="1198" cy="226" r="150" fill="url(#moonFill)" opacity=".2"/>
      <circle cx="1198" cy="226" r="150" fill="none" stroke="#e8c987" stroke-opacity=".18" stroke-width="1"/>
      <circle cx="1198" cy="226" r="150" fill="#e8c987" opacity=".05" filter="url(#moonGlow)"/>
      <path d="M1100 188c38-34 98-42 143-17M1120 265c32-18 76-20 106-2M1140 228c-8-24 2-47 18-57" stroke="#f1dcae" stroke-opacity=".12" stroke-width="1.2" fill="none"/>
      <g fill="#1a1511" opacity=".7">
        <path d="M963 168c9-7 17-7 25 0-7 1-13 5-17 12-2-5-5-9-8-12Z"/>
        <path d="M1000 147c7-6 14-6 21 0-6 1-11 5-14 10-2-4-4-7-7-10Z"/>
        <path d="M1024 183c6-5 12-5 18 0-5 1-9 4-12 8-1-3-3-6-6-8Z"/>
      </g>
    </g>

    <path d="M0 640 190 520l130 72 150-128 180 120 145-64 200 112 180-88 225 132v224H0Z" fill="url(#mountFar)" opacity=".72"/>
    <path d="M0 720 170 618l160 70 170-92 150 95 155-66 180 100 190-72 225 110v237H0Z" fill="url(#mountNear)" opacity=".9"/>

    <g opacity=".5" fill="none" stroke="#d8b36e" stroke-width="1">
      <path d="M180 594c26-34 60-51 102-52M330 574c31-25 61-36 92-34M690 614c27-30 56-43 88-40M1050 604c31-25 62-33 93-24M1260 640c32-22 62-28 92-18"/>
      <path d="M190 640c38-16 76-22 114-18M1240 686c36-14 71-17 105-8" stroke-opacity=".55"/>
    </g>

    <g opacity=".46" transform="translate(1080 282)">
      <path d="M-150 140 0 66l150 74-22 12-128-58-128 58Z" fill="#231a14" stroke="#b88a44" stroke-opacity=".3"/>
      <path d="M-178 152h356l-44 20H-134Z" fill="#1b1511" stroke="#b88a44" stroke-opacity=".22"/>
      <g stroke="#d8b36e" stroke-opacity=".2" fill="none">
        ${roofTiles(-160, 160, 146, 18)}
        <path d="M-210 144c-16-8-26-18-30-30M210 144c16-8 26-18 30-30"/>
      </g>
      <g fill="#1d1712" stroke="#b88a44" stroke-opacity=".16">
        <rect x="-142" y="176" width="18" height="118"/>
        <rect x="-76" y="176" width="18" height="118"/>
        <rect x="58" y="176" width="18" height="118"/>
        <rect x="124" y="176" width="18" height="118"/>
      </g>
      <path d="M-150 214h300M-150 270h300" stroke="#b88a44" stroke-opacity=".16" fill="none"/>
      <path d="M-34 180h68v114h-68z" fill="#120e0b" stroke="#d8b36e" stroke-opacity=".22"/>
      <path d="M-104 180h50v114h-50zM54 180h50v114h-50z" fill="#120e0b" stroke="#b88a44" stroke-opacity=".12"/>
      <path d="M-22 204h44v26h-44z" fill="#2c2018" stroke="#d8b36e" stroke-opacity=".4"/>
      <path d="M-10 211h20M0 211v13" stroke="#d8b36e" stroke-opacity=".55" fill="none"/>
      <path d="M-160 294h320" stroke="#b88a44" stroke-opacity=".2"/>
    </g>

    <g opacity=".62" fill="url(#gateFill)" stroke="#b88a44" stroke-opacity=".18">
      <path d="M1014 1000V760h-64V640h-46v-52l86-40h320l86 40v52h-46v120h-64v240Z"/>
    </g>

    <g opacity=".58" fill="none" stroke="#d8b36e" stroke-width="1.1">
      <path d="M884 712c72-44 148-62 226-54M1080 640c70-30 142-32 216-6"/>
      <path d="M910 746c58-26 118-36 180-30" stroke-opacity=".5"/>
      <path d="M500 900c120-34 240-36 360-6M860 936c120-22 240-18 360 12" stroke-opacity=".22"/>
    </g>

    <g opacity=".82">
      <path d="M-20 1000V760c10-88 26-144 58-184 30-38 71-66 123-84-36 38-54 78-60 120 30-42 70-68 120-80-38 34-58 72-64 112 30-30 64-46 102-50-32 24-54 54-68 92-12 32-15 68-9 108l8 66 38 140Z" fill="#14100d"/>
      <path d="M66 760c48-70 102-110 164-120M84 700c-36-44-54-92-54-144M117 660c-30-46-39-91-28-136M152 614c-16-40-19-78-8-113" stroke="#2b2119" stroke-width="9" fill="none" stroke-linecap="round"/>
      <g stroke="#2b2119" stroke-width="2" stroke-linecap="round" opacity=".9">
        ${pineNeedles(206, 606, 36, 11)}
        ${pineNeedles(166, 540, 28, 9)}
        ${pineNeedles(120, 574, 26, 9)}
        ${pineNeedles(248, 660, 30, 9)}
        ${pineNeedles(96, 670, 24, 8)}
      </g>
      <g stroke="#d8b36e" stroke-opacity=".08" stroke-width="1" fill="none">
        ${pineNeedles(206, 606, 24, 7)}
        ${pineNeedles(166, 540, 18, 6)}
      </g>
    </g>

    <g fill="none" stroke="#d8b36e" stroke-width="1.2" stroke-linecap="round" opacity=".2">
      <path d="M420 300c34-20 68-20 102 0 14 9 30 11 46 6M580 340c26-17 53-19 80-6 12 6 26 7 40 2"/>
      <path d="M1230 430c30-18 60-18 90 0M1310 470c24-14 48-15 72-3"/>
      <path d="M760 210c20-13 42-13 62 0M830 238c18-11 35-11 52 0" stroke-opacity=".5"/>
    </g>

    <rect y="820" width="1600" height="180" fill="url(#mountNear)" opacity=".75"/>
    <rect y="930" width="1600" height="70" fill="#120f0d"/>
  </svg>`;
}

export function cultureArt(kind) {
  const common = 'fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"';
  if (kind === 'lingxing') {
    return `<svg viewBox="0 0 140 100" aria-hidden="true">
      <g ${common}>
        <path d="M12 88h116M22 88V50M118 88V50M22 50h96"/>
        <path d="M14 50 70 20l56 30-9 5-47-23-47 23Z"/>
        <path d="M38 50V34M56 50V34M84 50V34M102 50V34"/>
        <path d="M28 66h84M70 50v38"/>
        <path d="M30 58c10-5 20-5 30 0M80 58c10-5 20-5 30 0"/>
        <path d="M58 66h24v22H58z"/>
      </g>
      <circle cx="70" cy="44" r="3" fill="currentColor" opacity=".45"/>
    </svg>`;
  }
  if (kind === 'dacheng') {
    return `<svg viewBox="0 0 140 100" aria-hidden="true">
      <g ${common}>
        <path d="M12 78h116M22 78V52M118 78V52"/>
        <path d="M8 52 28 38h84l20 14-12 7-42-20-42 20Z"/>
        <path d="M28 38 52 16h36l24 22"/>
        <path d="M46 28h48M54 22h32"/>
        <path d="M34 52v26M54 52v26M86 52v26M106 52v26"/>
        <path d="M58 52h24v26H58z"/>
        <path d="M63 58h14M70 58v14"/>
        <path d="M22 88h96" stroke-dasharray="3 4"/>
      </g>
      <circle cx="70" cy="46" r="2.6" fill="currentColor" opacity=".4"/>
    </svg>`;
  }
  if (kind === 'dougong') {
    return `<svg viewBox="0 0 140 100" aria-hidden="true">
      <g ${common}>
        <path d="M70 12v22M40 24h60M30 34h80M20 44h100"/>
        <path d="M70 34v20M48 44v14M92 44v14"/>
        <path d="M26 58h88M34 68h72M46 78h48"/>
        <path d="M18 58h-8M122 58h8M26 68h-8M114 68h8M46 78h-8M94 78h8"/>
        <path d="M60 58v10M80 58v10"/>
      </g>
    </svg>`;
  }
  if (kind === 'huiwen') {
    const motif = `<path d="M0 22h14v-8H6v-6h16v22H0v-8h14v-8" ${common}/>`;
    return `<svg viewBox="0 0 140 100" aria-hidden="true">
      <defs><g id="huiwen-motif">${motif}</g></defs>
      <g transform="translate(6 34)" opacity=".85">
        <use href="#huiwen-motif"/>
        <use href="#huiwen-motif" x="26"/>
        <use href="#huiwen-motif" x="52"/>
        <use href="#huiwen-motif" x="78"/>
      </g>
      <g transform="translate(6 64)" opacity=".45">
        <use href="#huiwen-motif"/>
        <use href="#huiwen-motif" x="26"/>
        <use href="#huiwen-motif" x="52"/>
        <use href="#huiwen-motif" x="78"/>
      </g>
      <path d="M8 20h124M8 90h124" stroke="currentColor" stroke-opacity=".25"/>
    </svg>`;
  }
  if (kind === 'cloud') {
    return `<svg viewBox="0 0 140 100" aria-hidden="true">
      <g ${common}>
        <path d="M20 62c0-9 7-16 16-16 3 0 6 1 8 3 3-10 12-17 23-17 12 0 22 8 24 20 9-1 17 6 17 15 0 9-7 16-16 16H36c-9 0-16-7-16-15Z"/>
        <path d="M44 76c-2 7 1 13 8 17M64 77c-2 8 1 14 8 18M84 76c-1 7 2 12 8 15"/>
        <path d="M32 54c8-7 18-9 28-6M62 42c8-5 17-5 25-1"/>
      </g>
      <path d="M8 92c14-8 28-10 42-6M94 22c8-4 16-4 24 0" stroke="currentColor" stroke-opacity=".28" fill="none"/>
    </svg>`;
  }
  if (kind === 'kite') {
    return `<svg viewBox="0 0 140 100" aria-hidden="true">
      <g ${common}>
        <path d="M70 8 104 42 70 88 36 42Z"/>
        <path d="M70 10v76M38 42h64"/>
        <path d="M70 88c-4 8 2 12 8 10 4-2 4-7 0-8-6-2-12 4-10 10"/>
        <path d="M26 24c-8 6-12 13-12 22M114 24c8 6 12 13 12 22"/>
      </g>
      <circle cx="59" cy="34" r="2" fill="currentColor" opacity=".5"/>
      <circle cx="81" cy="34" r="2" fill="currentColor" opacity=".5"/>
      <path d="M58 56c8 5 16 5 24 0" stroke="currentColor" stroke-opacity=".45" fill="none"/>
    </svg>`;
  }
  if (kind === 'virtues') {
    return `<svg viewBox="0 0 140 100" aria-hidden="true">
      <g ${common}>
        <rect x="18" y="16" width="30" height="30" rx="2"/>
        <rect x="55" y="16" width="30" height="30" rx="2"/>
        <rect x="92" y="16" width="30" height="30" rx="2"/>
        <rect x="55" y="54" width="30" height="30" rx="2"/>
        <path d="M33 24v14M27 31h12M70 24v14M64 31h12M107 24v14M101 31h12M70 62v14M64 69h12"/>
      </g>
      <text x="33" y="42" text-anchor="middle" fill="currentColor" font-size="10" opacity=".8">仁</text>
      <text x="70" y="42" text-anchor="middle" fill="currentColor" font-size="10" opacity=".8">义</text>
      <text x="107" y="42" text-anchor="middle" fill="currentColor" font-size="10" opacity=".8">礼</text>
      <text x="70" y="80" text-anchor="middle" fill="currentColor" font-size="10" opacity=".8">智</text>
      <text x="70" y="96" text-anchor="middle" fill="currentColor" font-size="9" opacity=".5">信</text>
    </svg>`;
  }
  return `<svg viewBox="0 0 140 100" aria-hidden="true"><g ${common}><circle cx="70" cy="50" r="28"/><path d="M70 22v56M42 50h56"/></g></svg>`;
}

export function smallCloud(className = '') {
  return `<svg class="${className}" viewBox="0 0 320 120" fill="none" aria-hidden="true">
    <path d="M22 76c0-16 12-28 28-28 5 0 10 1 14 4 5-18 21-30 41-30 21 0 39 14 43 34 16-2 30 10 30 26 0 15-12 27-28 27H50c-15 0-28-12-28-27Z" stroke="currentColor" stroke-width="1.4"/>
    <path d="M78 100c-3 9 2 16 10 20M124 101c-2 10 3 17 12 22M172 100c-1 8 4 14 12 18" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
    <path d="M56 66c14-10 30-13 48-9M112 48c13-8 28-9 42-4" stroke="currentColor" stroke-width="1" stroke-linecap="round" opacity=".7"/>
  </svg>`;
}
