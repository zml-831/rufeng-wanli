/**
 * 《论语》公版文本摘句。
 * 仅用于游戏内的文化提示，原文以通行本为准。
 */

export const QUOTES = [
  { text: '学而时习之，不亦说乎？', source: '《论语·学而》', tag: '学' },
  { text: '三人行，必有我师焉。', source: '《论语·述而》', tag: '师' },
  { text: '温故而知新，可以为师矣。', source: '《论语·为政》', tag: '学' },
  { text: '知之为知之，不知为不知，是知也。', source: '《论语·为政》', tag: '智' },
  { text: '己所不欲，勿施于人。', source: '《论语·卫灵公》', tag: '仁' },
  { text: '礼之用，和为贵。', source: '《论语·学而》', tag: '礼' },
  { text: '见贤思齐焉，见不贤而内自省也。', source: '《论语·里仁》', tag: '省' },
  { text: '君子和而不同，小人同而不和。', source: '《论语·子路》', tag: '和' },
  { text: '德不孤，必有邻。', source: '《论语·里仁》', tag: '德' },
  { text: '博学而笃志，切问而近思，仁在其中矣。', source: '《论语·子张》', tag: '学' },
  { text: '不愤不启，不悱不发。', source: '《论语·述而》', tag: '教' },
  { text: '工欲善其事，必先利其器。', source: '《论语·卫灵公》', tag: '行' },
  { text: '人而无信，不知其可也。', source: '《论语·为政》', tag: '信' },
  { text: '过而不改，是谓过矣。', source: '《论语·卫灵公》', tag: '省' },
  { text: '岁寒，然后知松柏之后凋也。', source: '《论语·子罕》', tag: '节' },
  { text: '知者乐水，仁者乐山。', source: '《论语·雍也》', tag: '仁智' },
  { text: '敏而好学，不耻下问。', source: '《论语·公冶长》', tag: '学' },
  { text: '士不可以不弘毅，任重而道远。', source: '《论语·泰伯》', tag: '志' },
  { text: '逝者如斯夫，不舍昼夜。', source: '《论语·子罕》', tag: '时' },
  { text: '君子坦荡荡，小人长戚戚。', source: '《论语·述而》', tag: '君子' },
  { text: '不患人之不己知，患不知人也。', source: '《论语·学而》', tag: '知人' },
  { text: '志于道，据于德，依于仁，游于艺。', source: '《论语·述而》', tag: '志' },
  { text: '知者不惑，仁者不忧，勇者不惧。', source: '《论语·子罕》', tag: '仁智' },
  { text: '躬自厚而薄责于人，则远怨矣。', source: '《论语·卫灵公》', tag: '省' },
  { text: '君子欲讷于言而敏于行。', source: '《论语·里仁》', tag: '行' },
  { text: '老者安之，朋友信之，少者怀之。', source: '《论语·公冶长》', tag: '仁' },
  { text: '有朋自远方来，不亦乐乎？', source: '《论语·学而》', tag: '友' },
];

const BY_TAG = {
  launch: ['志于道，据于德，依于仁，游于艺。', '士不可以不弘毅，任重而道远。'],
  flight: ['知者乐水，仁者乐山。', '知者不惑，仁者不忧，勇者不惧。', '三人行，必有我师焉。'],
  finish: ['学而时习之，不亦说乎？', '温故而知新，可以为师矣。'],
  win: ['德不孤，必有邻。', '君子和而不同，小人同而不和。', '有朋自远方来，不亦乐乎？'],
  capture: ['过而不改，是谓过矣。', '己所不欲，勿施于人。', '见贤思齐焉，见不贤而内自省也。'],
};

function pick(list, rng) {
  return list[Math.floor(rng() * list.length) % list.length];
}

export function quoteByText(text) {
  return QUOTES.find((q) => q.text === text) || null;
}

export function quoteFromList(texts, rng = Math.random) {
  const chosen = pick(texts, rng);
  return quoteByText(chosen);
}

export function openingQuote(rng = Math.random) {
  return QUOTES[Math.floor(rng() * QUOTES.length) % QUOTES.length];
}

export function eventQuote(kind, rng = Math.random) {
  const list = BY_TAG[kind];
  if (!list) return null;
  return quoteFromList(list, rng);
}

export function randomQuote(rng = Math.random) {
  return openingQuote(rng);
}
