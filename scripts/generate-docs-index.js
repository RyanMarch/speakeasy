import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DOCS_DIR = path.join(__dirname, '../docs');
const OUTPUT_FILE = path.join(DOCS_DIR, 'search-index.json');

// Load config to dynamically strip project name suffixes
const configPath = path.join(DOCS_DIR, 'docs-config.json');
const config = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, 'utf-8')) : {};
const projectName = config.projectName || 'Help Center';

// Helper to decode HTML entities
function unescapeHtml(text) {
    return (text || '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#039;|&apos;/g, "'");
}

// Helper to strip HTML tags, unescape entities, and clean up whitespace
function cleanText(text) {
    return unescapeHtml(text)
        .replace(/<[^>]+>/g, '') // Remove HTML tags
        .replace(/\s+/g, ' ')    // Normalize spaces
        .trim();
}

function generateIndex() {
    const entries = [];
    const files = fs.readdirSync(DOCS_DIR);

    // Escape special characters in project name for regex safety
    const safeProjectName = projectName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const stripProjectRegex = new RegExp(`\\s*—\\s*${safeProjectName}\\s*(Docs)?`, 'i');

    for (const file of files) {
        const fullPath = path.join(DOCS_DIR, file);
        if (!fs.statSync(fullPath).isDirectory()) continue;

        const indexPath = path.join(fullPath, 'index.html');
        if (!fs.existsSync(indexPath)) continue;

        const html = fs.readFileSync(indexPath, 'utf-8');

        // Extract Title
        const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
        let title = titleMatch ? titleMatch[1] : '';
        // Clean title suffix and unescape entities
        title = unescapeHtml(title.replace(stripProjectRegex, '').replace(/\s*Naming\s*Guide/i, '').trim());

        // Extract Excerpt (Meta Description)
        const excerptMatch = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i) ||
                             html.match(/<meta\s+content="([^"]+)"\s+name="description"/i);
        const excerpt = unescapeHtml(excerptMatch ? excerptMatch[1] : '');

        // Extract Category
        const categoryMatch = html.match(/<meta\s+name="category"\s+content="([^"]+)"/i) ||
                               html.match(/<meta\s+content="([^"]+)"\s+name="category"/i);
        const category = unescapeHtml(categoryMatch ? categoryMatch[1] : 'Guides');

        // Extract Doc ID (fallback to folder name)
        const idMatch = html.match(/<meta\s+name="doc-id"\s+content="([^"]+)"/i) ||
                        html.match(/<meta\s+content="([^"]+)"\s+name="doc-id"/i);
        const id = idMatch ? idMatch[1] : file;

        // Extract Headings (H2 and H3)
        const headings = [];
        const headingRegex = /<(h2|h3)[^>]*>([\s\S]*?)<\/\1>/gi;
        let match;
        while ((match = headingRegex.exec(html)) !== null) {
            const rawHeadingText = match[2];
            // Remove anchor elements within headings
            const cleanHeading = cleanText(rawHeadingText.replace(/<a[^>]*>[\s\S]*?<\/a>/gi, ''));
            if (cleanHeading && cleanHeading !== 'Table of Contents' && !headings.includes(cleanHeading)) {
                headings.push(cleanHeading);
            }
        }

        // Exclude overview from headings list if it's already there (usually duplicate of title or h1)
        const finalHeadings = headings.filter(h => h.toLowerCase() !== 'overview');

        entries.push({
            id,
            title,
            path: `${file}/`,
            category,
            headings: ['Overview', ...finalHeadings],
            excerpt,
            lastUpdated: new Date().toISOString().split('T')[0]
        });
    }

    // Sort entries by category priority, then title.
    const categoryOrder = { 'Basics': 1, 'General': 2, 'Guides': 3 };
    entries.sort((a, b) => {
        const orderA = categoryOrder[a.category] || 99;
        const orderB = categoryOrder[b.category] || 99;
        if (orderA !== orderB) return orderA - orderB;
        return a.title.localeCompare(b.title);
    });

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(entries, null, 2), 'utf-8');
    console.log(`Successfully generated docs search-index.json at ${OUTPUT_FILE}`);
}

generateIndex();
