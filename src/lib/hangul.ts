export const CHOSUNG_COUNT = 19;
export const JUNGSUNG_COUNT = 21;
export const JONGSUNG_COUNT = 28;

export const CHOSUNG = [
    "ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ",
    "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"
];

export const JUNGSUNG = [
    "ㅏ", "ㅐ", "ㅑ", "ㅒ", "ㅓ", "ㅔ", "ㅕ", "ㅖ", "ㅗ", "ㅘ",
    "ㅙ", "ㅚ", "ㅛ", "ㅜ", "ㅝ", "ㅞ", "ㅟ", "ㅠ", "ㅡ", "ㅢ",
    "ㅣ"
];

export const JONGSUNG = [
    "", "ㄱ", "ㄲ", "ㄳ", "ㄴ", "ㄵ", "ㄶ", "ㄷ", "ㄹ", "ㄺ",
    "ㄻ", "ㄼ", "ㄽ", "ㄾ", "ㄿ", "ㅀ", "ㅁ", "ㅂ", "ㅄ", "ㅅ",
    "ㅆ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"
]; // Note: empty string for no jongsung (index 0)

export function decomposeHangul(char: string) {
    const code = char.charCodeAt(0);
    if (code < 0xAC00 || code > 0xD7A3) {
        return null;
    }
    const s = code - 0xAC00;
    const cho = Math.floor(s / 588);
    const jung = Math.floor((s % 588) / 28);
    const jong = s % 28;
    return { cho, jung, jong };
}

export function composeHangul(cho: number, jung: number, jong: number) {
    return String.fromCharCode(0xAC00 + (cho * 588) + (jung * 28) + jong);
}
