import { memo, useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

function MathMarkup({
  children,
  display = false,
}: {
  children: string;
  display?: boolean;
}) {
  const html = useMemo(
    () =>
      katex.renderToString(children, {
        displayMode: display,
        output: 'htmlAndMathml',
        throwOnError: true,
        trust: false,
        strict: 'error',
      }),
    [children, display],
  );
  // Only KaTeX output from developer-authored formulas; no user formula input.
  return (
    <span
      className={display ? 'math-display' : 'math-inline'}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
export const InlineMath = memo(({ children }: { children: string }) => (
  <MathMarkup>{children}</MathMarkup>
));
export const DisplayMath = memo(({ children }: { children: string }) => (
  <MathMarkup display>{children}</MathMarkup>
));
