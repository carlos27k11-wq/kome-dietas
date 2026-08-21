/* ============================================================
   Iconos de perfil. Están agrupados para que la rejilla se lea
   sin buscar: primero caras y personas, luego animales, comida,
   naturaleza y cosas. La lista plana (AVATARS) es la que usan
   las pantallas antiguas; AVATAR_GROUPS es la que se pinta.
   ============================================================ */

export const AVATAR_GROUPS = [
  {
    label: "Personas",
    emojis: ["🙂", "😀", "😎", "🤗", "🥰", "🤓", "😇", "🧑", "👩", "👨", "👵", "👴", "👧", "👦", "👩‍🦰", "👨‍🦳", "🧔", "👩‍🦱", "🧑‍🍳", "👩‍⚕️", "🧑‍🌾", "🏃", "🚴", "🧘"],
  },
  {
    label: "Animales",
    emojis: ["🐱", "🐶", "🦊", "🐼", "🐨", "🐰", "🐹", "🐻", "🐯", "🦁", "🐮", "🐷", "🐸", "🐵", "🐧", "🐦", "🦉", "🦆", "🐢", "🐬", "🐠", "🐟", "🦋", "🐝"],
  },
  {
    label: "Comida",
    emojis: ["🍙", "🍣", "🍜", "🍚", "🍡", "🍥", "🍱", "🥗", "🍎", "🍊", "🍌", "🍓", "🍇", "🍉", "🥑", "🥦", "🥕", "🌽", "🍅", "🥐", "🍞", "🧀", "🥚", "🍫"],
  },
  {
    label: "Bebidas y dulces",
    emojis: ["🍵", "☕", "🧃", "🥤", "🍯", "🍦", "🍩", "🍪", "🎂", "🧁", "🍬", "🍒"],
  },
  {
    label: "Naturaleza",
    emojis: ["🌸", "🌿", "🌙", "🍄", "🌻", "🌹", "🌷", "🌺", "🍀", "🌵", "🌳", "🌲", "⭐", "☀️", "🌈", "🌊", "❄️", "🔥"],
  },
  {
    label: "Cosas",
    emojis: ["⛩️", "🏠", "🎈", "🎁", "🎵", "📚", "🎨", "⚽", "🏀", "🎾", "🚗", "✈️", "⛵", "🚀", "💡", "🔑", "⏰", "❤️", "💚", "💙", "💜", "🧡", "🩵", "🤍"],
  },
];

export const AVATARS = AVATAR_GROUPS.flatMap((g) => g.emojis);

/** Colores del marco del avatar. Todos legibles sobre claro y oscuro. */
export const AVATAR_COLORS = [
  "#f09bb6", "#f0c069", "#79b0dc", "#9cc97f", "#b98ce0", "#e5875e",
  "#a3145a", "#8a5200", "#10557f", "#1f6b35", "#5c34a3", "#ad3315",
];
