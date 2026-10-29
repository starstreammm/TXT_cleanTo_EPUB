import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Box } from "@mui/material";
import { useTheme, type CssVarsTheme } from "@mui/material/styles";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

const previewDocument =
    '<!doctype html><html><head><link rel="stylesheet" href="/epub.css"></head><body></body></html>';
const remarkPlugins = [remarkGfm];

export default function MarkdownPreview({
    content,
    uid,
    fontSize,
    dark,
}: {
    content: string;
    uid: string;
    fontSize: number;
    dark: boolean;
}) {
    const theme = useTheme<CssVarsTheme>();
    const [body, setBody] = useState<HTMLElement | null>(null);
    const palette =
        theme.colorSchemes?.[dark ? "dark" : "light"]?.palette ?? theme.palette;

    useEffect(() => {
        if (!body) return;
        Object.assign(body.style, {
            margin: "0",
            padding: "24px",
            fontSize: `${fontSize}px`,
            color: palette.text.primary,
            backgroundColor: palette.background.paper,
            overflowWrap: "anywhere",
            colorScheme: dark ? "dark" : "light",
        });
    }, [body, fontSize, dark, palette.text.primary, palette.background.paper]);

    useEffect(() => {
        body?.ownerDocument.defaultView?.scrollTo(0, 0);
    }, [body, content]);

    return (
        <Box
            component="iframe"
            title="Formatted Markdown preview"
            sandbox="allow-same-origin"
            srcDoc={previewDocument}
            onLoad={(event) =>
                setBody(event.currentTarget.contentDocument?.body ?? null)
            }
            sx={{
                width: "50%",
                height: "100%",
                border: 0,
                borderLeft: 1,
                borderColor: "divider",
                bgcolor: "background.paper",
            }}
        >
            {body &&
                createPortal(
                    <Markdown
                        remarkPlugins={remarkPlugins}
                        components={{
                            img: ({ node, src, ...props }) => {
                                const local =
                                    typeof src === "string" &&
                                    !/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(src);
                                const source = local
                                    ? `/api/file/image?${new URLSearchParams({ uid, src: src as string })}`
                                    : src;
                                return (
                                    <img
                                        {...props}
                                        src={source}
                                        style={{ maxWidth: "100%" }}
                                    />
                                );
                            },
                            a: ({ node, ...props }) => (
                                <a
                                    {...props}
                                    target="_blank"
                                    rel="noreferrer"
                                />
                            ),
                        }}
                    >
                        {content}
                    </Markdown>,
                    body,
                )}
        </Box>
    );
}
