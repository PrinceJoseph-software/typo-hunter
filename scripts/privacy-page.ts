/**
 * Builds the standalone /privacy.html page from PRIVACY.md at build time, so the
 * public page and the repository policy can never drift apart. Handles the small
 * Markdown subset PRIVACY.md uses: headings, paragraphs, bullet and numbered
 * lists, tables, **bold**, *italic*, `code`, [links](url) and <autolinks>.
 */

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function inline(text: string): string {
  let out = escapeHtml(text);
  out = out.replace(/&lt;(https?:\/\/[^\s&]+)&gt;/g, '<a href="$1">$1</a>');
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label, href) => {
    const url = String(href).replace(/^PRIVACY\.md$/, '/privacy.html');
    const external = /^https?:\/\//.test(url);
    return `<a href="${url}"${external ? ' rel="noopener"' : ''}>${label}</a>`;
  });
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
  return out;
}

export function markdownToHtml(md: string): string {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const html: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      html.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      i++;
      continue;
    }
    if (line.startsWith('|')) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].startsWith('|')) {
        if (!/^\|[\s|:-]+\|$/.test(lines[i])) {
          rows.push(lines[i].split('|').slice(1, -1).map(c => c.trim()));
        }
        i++;
      }
      const [head, ...body] = rows;
      html.push(
        '<table><thead><tr>' + head.map(c => `<th>${inline(c)}</th>`).join('') + '</tr></thead><tbody>' +
          body.map(r => '<tr>' + r.map(c => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') +
          '</tbody></table>'
      );
      continue;
    }
    if (/^- /.test(line) || /^\d+\.\s/.test(line)) {
      const ordered = /^\d+\.\s/.test(line);
      const items: string[] = [];
      while (i < lines.length && (ordered ? /^\d+\.\s/.test(lines[i]) : /^- /.test(lines[i]))) {
        items.push(lines[i].replace(ordered ? /^\d+\.\s+/ : /^- /, ''));
        i++;
      }
      const tag = ordered ? 'ol' : 'ul';
      html.push(`<${tag}>` + items.map(it => `<li>${inline(it)}</li>`).join('') + `</${tag}>`);
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#|\||- |\d+\.\s)/.test(lines[i])) {
      para.push(lines[i].trim());
      i++;
    }
    html.push(`<p>${inline(para.join(' '))}</p>`);
  }
  return html.join('\n');
}

export function buildPrivacyPage(md: string, siteUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Privacy Policy · Typo Hunter</title>
<meta name="description" content="How Typo Hunter handles your data: no accounts, no tracking, and your photos stay on your device." />
<link rel="canonical" href="${siteUrl}privacy.html" />
<meta name="robots" content="index, follow" />
<meta property="og:title" content="Typo Hunter Privacy Policy" />
<meta property="og:description" content="No accounts, no tracking, and your photos stay on your device." />
<meta property="og:url" content="${siteUrl}privacy.html" />
<meta property="og:image" content="${siteUrl}og-image.png" />
<meta name="theme-color" content="#282722" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<style>
  :root { color-scheme: light; }
  body { margin: 0; background: #F4EBDD; color: #282722; font: 16px/1.6 system-ui, -apple-system, "Segoe UI", sans-serif; }
  main { max-width: 720px; margin: 0 auto; padding: 24px 16px 64px; }
  .back { display: inline-block; margin-bottom: 16px; font-weight: 700; color: #D66A4A; text-decoration: none; }
  h1 { font-size: 2rem; line-height: 1.2; margin: 0 0 8px; }
  h2 { font-size: 1.25rem; margin: 32px 0 8px; border-top: 2px solid #282722; padding-top: 16px; }
  a { color: #b4502f; }
  table { width: 100%; border-collapse: collapse; background: #FFFDF9; border: 2px solid #282722; font-size: 0.95rem; }
  th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #d9cfbf; vertical-align: top; }
  th { background: #E8B92D; }
  code { background: #FFFDF9; padding: 0 4px; border-radius: 4px; }
  li { margin: 4px 0; }
  @media (max-width: 480px) { table { font-size: 0.85rem; } th, td { padding: 6px; } }
</style>
</head>
<body>
<main>
<a class="back" href="/">← Back to Typo Hunter</a>
${markdownToHtml(md)}
</main>
</body>
</html>
`;
}
