/**
 * BDF (Glyph Bitmap Distribution Format) 내보내기
 * 스펙: https://adobe-type-tools.github.io/font-tech-notes/pdfs/5005.BDF_Spec.pdf
 *
 * 16x16 픽셀, 각 행은 2바이트(uint16) Big Endian으로 저장된 ArrayBuffer를 입력받음.
 * 버퍼 레이아웃: 글리프 i의 오프셋 = i * 32 (16행 × 2바이트)
 */
export function exportBDF(buffer: ArrayBuffer, fontName = 'bithangul'): string {
    const TOTAL = 11172;
    const START = 0xAC00;
    const view = new DataView(buffer);

    // XLFD 폰트 이름에서 공백 및 특수문자 제거
    const safeName = fontName.replace(/[^a-zA-Z0-9가-힣_-]/g, '_').toLowerCase();

    const lines: string[] = [];

    // ── 파일 헤더 ──────────────────────────────────────────────────────────────
    lines.push('STARTFONT 2.1');
    lines.push(`FONT -misc-${safeName}-medium-r-normal--16-160-75-75-c-160-iso10646-1`);
    lines.push('SIZE 16 75 75');
    // BBX: width height xoff yoff  (16×16, baseline at row 2 from bottom)
    lines.push('FONTBOUNDINGBOX 16 16 0 -2');
    lines.push('STARTPROPERTIES 4');
    lines.push('FONT_ASCENT 14');
    lines.push('FONT_DESCENT 2');
    lines.push('DEFAULT_CHAR 0');
    lines.push('CHARSET_REGISTRY "ISO10646"');
    lines.push('ENDPROPERTIES');
    lines.push(`CHARS ${TOTAL}`);

    // ── 글리프 ─────────────────────────────────────────────────────────────────
    for (let i = 0; i < TOTAL; i++) {
        const codePoint = START + i;
        const offset = i * 32; // 16행 × 2바이트

        lines.push(`STARTCHAR U+${codePoint.toString(16).toUpperCase().padStart(4, '0')}`);
        lines.push(`ENCODING ${codePoint}`);
        // SWIDTH: scalable width in 1/1000 of point size (16px → 1000)
        lines.push('SWIDTH 1000 0');
        // DWIDTH: device width in pixels
        lines.push('DWIDTH 16 0');
        // BBX: width height xoff yoff
        lines.push('BBX 16 16 0 -2');
        lines.push('BITMAP');

        for (let r = 0; r < 16; r++) {
            const rowVal = view.getUint16(offset + r * 2, false); // Big Endian
            // BDF BITMAP 행: 16비트 → 4자리 hex (상위 바이트, 하위 바이트 순)
            lines.push(rowVal.toString(16).toUpperCase().padStart(4, '0'));
        }

        lines.push('ENDCHAR');
    }

    lines.push('ENDFONT');
    return lines.join('\n');
}

/**
 * GNU Unifont HEX 형식 내보내기
 * 스펙: https://czyborra.com/unifont/
 *
 * 각 줄: XXXX:HHHH...HHHH
 *   - XXXX: 4자리 유니코드 코드포인트 (대문자 hex)
 *   - 16x16 fullwidth 글리프: 16행 × 4 hex 자리 = 64 hex 문자
 */
export function exportHEX(buffer: ArrayBuffer): string {
    const TOTAL = 11172;
    const START = 0xAC00;
    const view = new DataView(buffer);

    const lines: string[] = [];

    for (let i = 0; i < TOTAL; i++) {
        const codePoint = START + i;
        const offset = i * 32;

        let hexBitmap = '';
        for (let r = 0; r < 16; r++) {
            const rowVal = view.getUint16(offset + r * 2, false);
            // 16x16 fullwidth: 각 행은 2바이트 → 4 hex 자리
            hexBitmap += rowVal.toString(16).toUpperCase().padStart(4, '0');
        }

        // 총 64 hex 자리 (16행 × 4자리)
        lines.push(`${codePoint.toString(16).toUpperCase().padStart(4, '0')}:${hexBitmap}`);
    }

    return lines.join('\n');
}

/**
 * 문자열을 파일로 다운로드
 */
export function downloadText(content: string, filename: string, mimeType = 'text/plain') {
    const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // 브라우저가 다운로드를 시작할 시간을 확보한 후 URL 해제
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
