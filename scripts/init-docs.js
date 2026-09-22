import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Safe configuration lookup from your /docs/ directory
const configPath = path.join(__dirname, '../public/docs/docs-config.json');
if (!fs.existsSync(configPath)) {
    console.error('Error: docs-config.json not found in /docs/. Run this after creating your config.');
    process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
const defaultFontsUrl = 'https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300..700;1,9..40,300..700&family=Josefin+Sans:ital,wght@0,300..700;1,300..700&family=Jost:ital,wght@0,300..800;1,300..800&family=Playfair+Display:ital,wght@0,400..900;1,400..900&display=swap';
const fontsConfig = config.googleFontsUrl !== undefined ? config.googleFontsUrl : true;
let fontsHtml = '';
if (fontsConfig) {
    const url = typeof fontsConfig === 'string' ? fontsConfig : defaultFontsUrl;
    fontsHtml = `<!-- Preconnect Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="${url}" rel="stylesheet">`;
}

const placeholders = {
    '{{PROJECT_NAME}}': config.projectName || 'App',
    '{{PREFIX}}': config.componentPrefix || 'app',
    '{{BASE_URL}}': (config.baseUrl || 'http://localhost').replace(/\/$/, ''),
    '{{FAVICON_DIR}}': config.faviconDir || './assets/favicon',
    '{{FONTS_LOAD_LINK}}': fontsHtml
};

const TEMPLATE_DIR = path.join(__dirname, 'templates');
const TARGET_DIR = path.join(__dirname, '../public/docs');

function buildTemplate(fileName) {
    const srcPath = path.join(TEMPLATE_DIR, fileName);
    const destPath = path.join(TARGET_DIR, fileName);

    if (!fs.existsSync(srcPath)) return;

    let content = fs.readFileSync(srcPath, 'utf-8');

    // Swap out all template placeholders dynamically
    Object.keys(placeholders).forEach(token => {
        const regex = new RegExp(token, 'g');
        content = content.replace(regex, placeholders[token]);
    });

    fs.writeFileSync(destPath, content, 'utf-8');
    console.log(`Generated portable shell: docs/${fileName}`);
}

console.log('Compiling core helpdoc shell pages...');
buildTemplate('index.html');
buildTemplate('list.html');
console.log('✨ Shell setup complete!');
