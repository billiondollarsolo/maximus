import { useMemo, type ComponentPropsWithoutRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { cn } from "#/lib/cn";
import { CodeBlock, InlineCode } from "./code-block";
import { prepareStreamingMarkdown, textFromReactChildren } from "./stream-markdown";

/**
 * ChatGPT-class assistant markdown: GFM + syntax highlighting + copyable fences.
 * Stream-safe (auto-closes open code fences). No raw HTML (XSS-safe).
 *
 * Pass `streaming` while tokens still arrive: still renders live GFM/markdown,
 * but skips syntax highlighting (cheap enough for ~60fps token paints).
 */
export function MarkdownRenderer({
  content,
  className,
  streaming = false,
}: {
  content: string;
  className?: string;
  /** Live stream — fence auto-close on, highlight off */
  streaming?: boolean;
}) {
  const source = useMemo(
    () => prepareStreamingMarkdown(content),
    [content],
  );

  const rehypePlugins = useMemo(
    () => (streaming ? [] : [rehypeHighlight]),
    [streaming],
  );

  return (
    <div
      className={cn(
        "msg-prose markdown-body",
        streaming && "markdown-streaming",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={rehypePlugins}
        components={{
          pre({ children, className: preClass }) {
            const child = Array.isArray(children) ? children[0] : children;
            const props =
              child &&
              typeof child === "object" &&
              "props" in child
                ? (child as {
                    props?: {
                      className?: string;
                      children?: unknown;
                    };
                  }).props
                : undefined;
            const cls = props?.className ?? "";
            const langMatch = /language-([\w+-]+)/.exec(cls);
            const language = langMatch?.[1] ?? "code";
            const plain = textFromReactChildren(props?.children).replace(
              /\n$/,
              "",
            );
            return (
              <CodeBlock language={language} code={plain} className={preClass}>
                <code className={cn(streaming ? undefined : "hljs", cls)}>
                  {props?.children as never}
                </code>
              </CodeBlock>
            );
          },
          code({ className: codeClass, children, ...rest }) {
            const isBlock = Boolean(
              codeClass && /language-/.test(codeClass),
            );
            if (isBlock) {
              return (
                <code className={codeClass} {...rest}>
                  {children}
                </code>
              );
            }
            return <InlineCode className={codeClass}>{children}</InlineCode>;
          },
          a({ href, children }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noreferrer noopener"
                className="text-accent underline underline-offset-2 hover:opacity-90"
              >
                {children}
              </a>
            );
          },
          table({ children }) {
            return (
              <div className="md-table-wrap">
                <table>{children}</table>
              </div>
            );
          },
          p({ children }) {
            return <p>{children}</p>;
          },
          ul({ children }) {
            return <ul>{children}</ul>;
          },
          ol({ children }) {
            return <ol>{children}</ol>;
          },
          blockquote({ children }) {
            return <blockquote>{children}</blockquote>;
          },
          h1({ children }) {
            return <h1>{children}</h1>;
          },
          h2({ children }) {
            return <h2>{children}</h2>;
          },
          h3({ children }) {
            return <h3>{children}</h3>;
          },
          hr() {
            return <hr />;
          },
          input(props: ComponentPropsWithoutRef<"input">) {
            if (props.type === "checkbox") {
              return (
                <input
                  type="checkbox"
                  checked={Boolean(props.checked)}
                  disabled
                  readOnly
                  className="md-task-checkbox"
                />
              );
            }
            return <input {...props} />;
          },
        }}
      >
        {source}
      </ReactMarkdown>
      {streaming ? (
        <span
          className="ml-0.5 inline-block h-4 w-1.5 animate-pulse rounded-sm bg-text-muted align-text-bottom"
          aria-hidden
        />
      ) : null}
    </div>
  );
}
