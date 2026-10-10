import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { App } from '../app/App';
it('renders authored formulas as HTML and accessible MathML without invalid math', () => {
  const html = renderToStaticMarkup(createElement(App));
  expect(html).toContain('katex-html');
  expect(html).toContain('katex-mathml');
  expect(html).toContain('<math');
  expect(html).not.toContain('katex-error');
  expect(html).not.toContain('cdn.jsdelivr');
});
