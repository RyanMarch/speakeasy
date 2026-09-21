/**
 * Speakeasy site footer: copyright, Terms, and Help. One definition shared by
 * Home and the guest menu so the two can't drift apart. Styled by
 * `.home-footer` in css/home-view.css.
 */

export function renderSiteFooterHtml() {
  return /*html*/`
    <footer class="home-footer">
      <span>&copy; 2026 <a href="https://ryanmarch.me" class="home-footer-link" target="_blank" rel="noopener">Ryan March</a></span>
      <span class="home-footer-sep" aria-hidden="true">·</span>
      <a href="/terms" class="home-footer-link">Terms</a>
      <span class="home-footer-sep" aria-hidden="true">·</span>
      <a href="/docs/" class="home-footer-link">Help</a>
    </footer>
  `;
}
