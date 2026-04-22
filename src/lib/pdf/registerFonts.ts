/**
 * Register the NotoSansTC font family with @react-pdf/renderer.
 *
 * Server-side only — uses `fs.readFileSync` to load TTF binaries from disk.
 * Call `ensureFontsRegistered()` at the top of any PDF-generating function
 * to ensure the font is available before rendering.
 *
 * Missing font files are logged as warnings (not thrown) so the PDF lib
 * can still render (with default Latin font) and misconfiguration is
 * diagnosable without crashing the app.
 */
import { Font } from '@react-pdf/renderer';
import fs from 'node:fs';
import path from 'node:path';

const FONT_DIR = path.join(process.cwd(), 'src', 'lib', 'pdf', 'fonts');

let registered = false;

export function ensureFontsRegistered(): void {
    if (registered) return;
    registered = true;

    const regularPath = path.join(FONT_DIR, 'NotoSansTC-Regular.ttf');
    const boldPath = path.join(FONT_DIR, 'NotoSansTC-Bold.ttf');

    const hasRegular = fs.existsSync(regularPath);
    const hasBold = fs.existsSync(boldPath);

    if (!hasRegular && !hasBold) {
        console.warn('[pdf-fonts] missing: no NotoSansTC ttf files found under', FONT_DIR, '— Chinese will render as tofu');
        return;
    }

    const fonts: { src: string; fontWeight?: 'normal' | 'bold' }[] = [];
    if (hasRegular) {
        fonts.push({ src: regularPath, fontWeight: 'normal' });
    } else {
        console.warn('[pdf-fonts] missing NotoSansTC-Regular.ttf at', regularPath);
    }
    if (hasBold) {
        fonts.push({ src: boldPath, fontWeight: 'bold' });
    } else {
        console.warn('[pdf-fonts] missing NotoSansTC-Bold.ttf at', boldPath);
    }

    if (fonts.length > 0) {
        Font.register({ family: 'NotoSansTC', fonts });
    }
}
