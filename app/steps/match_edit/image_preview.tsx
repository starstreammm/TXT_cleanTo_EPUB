import { Backdrop, Paper, Box, Popper } from "@mui/material";
import { useMemo, useRef, useState } from "react";
import type * as Monaco from "monaco-editor";

interface ImagePreviewInfo {
    src: string;
    alt: string;
    /** screen rect of the cover widget, use it to position your popup */
    anchor: DOMRect;
    /** range of the whole ![alt](src) text in the model */
    range: Monaco.IRange;
}

/** the popup API you implement */
interface ImagePreviewApi {
    open: (info: ImagePreviewInfo) => void;
    onClick: () => void;
    close: () => void;
}

const IMG_RE = String.raw`!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)`;
const HIDDEN_CLASS = "md-image-hidden";

function ensureStyle() {
    if (document.getElementById("md-image-preview-style")) return;
    const s = document.createElement("style");
    s.id = "md-image-preview-style";
    s.textContent = `.${HIDDEN_CLASS}{color:transparent !important;}`;
    document.head.appendChild(s);
}

export function setupImagePreview(
    editor: Monaco.editor.IStandaloneCodeEditor,
    monaco: typeof Monaco,
    getApi: () => ImagePreviewApi | undefined, // read lazily, avoids stale closures
) {
    ensureStyle();

    const widgets = new Map<string, Monaco.editor.IContentWidget>();
    const decorations = editor.createDecorationsCollection();
    let raf = 0;

    const createWidget = (
        id: string,
        range: Monaco.Range,
        src: string,
        alt: string,
        width: number,
        height: number,
    ): Monaco.editor.IContentWidget => {
        const dom = document.createElement("span");
        // covers the original text exactly; swap in your own "transcode" component here
        dom.style.cssText = `
            display:inline-flex; align-items:center; box-sizing:border-box;
            width:${width}px; height:${height}px; padding:0 4px;
            background:var(--vscode-editor-background);
            color:var(--vscode-textLink-foreground, #3794ff);
            overflow:hidden; white-space:nowrap; text-overflow:ellipsis;
            cursor:pointer; border-radius:3px;
        `;
        dom.textContent = `🖼 ${alt || src}`;

        dom.onmouseenter = () =>
            getApi()?.open({ src, alt, range, anchor: dom.getBoundingClientRect() });
        dom.onclick = () =>
            getApi()?.onClick();
        dom.onmouseleave = () => getApi()?.close();

        return {
            getId: () => id,
            getDomNode: () => dom,
            getPosition: () => ({
                position: range.getStartPosition(),
                preference: [monaco.editor.ContentWidgetPositionPreference.EXACT],
            }),
            allowEditorOverflow: false,
        };
    };

    const render = () => {
        const model = editor.getModel();
        if (!model) return;

        const lineHeight = editor.getOption(monaco.editor.EditorOption.lineHeight);
        const cursorLine = editor.getPosition()?.lineNumber;
        const next = new Map<string, Monaco.editor.IContentWidget>();
        const decos: Monaco.editor.IModelDeltaDecoration[] = [];

        for (const vr of editor.getVisibleRanges()) {
            const matches = model.findMatches(IMG_RE, vr, true, false, null, true);

            for (const m of matches) {
                // keep the line being edited as raw text
                if (m.range.startLineNumber === cursorLine) continue;

                const a = editor.getScrolledVisiblePosition(m.range.getStartPosition());
                const b = editor.getScrolledVisiblePosition(m.range.getEndPosition());
                if (!a || !b) continue;
                if (a.top !== b.top) continue; // wrapped across lines, skip
                const width = Math.max(b.left - a.left, 0);

                const [, alt = "", src = ""] = m.matches!;
                // width/height in the id => widget is rebuilt on font size change
                const id = `img:${m.range.startLineNumber}:${m.range.startColumn}:${src}:${width}:${lineHeight}`;

                next.set(id, widgets.get(id) ?? createWidget(id, m.range, src, alt, width, lineHeight));
                decos.push({ range: m.range, options: { inlineClassName: HIDDEN_CLASS } });
            }
        }

        for (const [id, w] of widgets) if (!next.has(id)) editor.removeContentWidget(w);
        for (const [id, w] of next) if (!widgets.has(id)) editor.addContentWidget(w);

        widgets.clear();
        next.forEach((w, k) => widgets.set(k, w));
        decorations.set(decos);
    };

    const schedule = () => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(render);
    };

    const disposables = [
        editor.onDidScrollChange(schedule),
        editor.onDidChangeModelContent(schedule),
        editor.onDidChangeCursorPosition(schedule),
        editor.onDidLayoutChange(schedule),
        editor.onDidChangeConfiguration(schedule), // font size / wordWrap
        editor.onDidChangeModel(schedule),
    ];
    schedule();

    return () => {
        cancelAnimationFrame(raf);
        disposables.forEach((d) => d.dispose());
        widgets.forEach((w) => editor.removeContentWidget(w));
        widgets.clear();
        decorations.clear();
        getApi()?.close();
    };
}

/** returns the api for setupImagePreview and the element to render */
export function useImagePreviewPopup(uid: string) {
    const [info, setInfo] = useState<ImagePreviewInfo | null>(null);
    const [backdropOpen, setBackdropOpen] = useState(false);

    const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const widgetHovered = useRef(false);
    const popperHovered = useRef(false);
    const backdropOpened = useRef(false);

    const clearCloseTimer = () => {
        if (closeTimer.current !== null) {
            clearTimeout(closeTimer.current);
            closeTimer.current = null;
        }
    };

    const scheduleClose = (delay = 150) => {
        clearCloseTimer();

        if (backdropOpened.current) return;

        closeTimer.current = setTimeout(() => {
            closeTimer.current = null;

            if (
                !widgetHovered.current &&
                !popperHovered.current &&
                !backdropOpened.current
            ) {
                setInfo(null);
            }
        }, delay);
    };

    const api = useMemo<ImagePreviewApi>(() => ({
        open: (i) => {
            clearCloseTimer();
            widgetHovered.current = true;
            setInfo(i);
        },

        onClick: () => {
            clearCloseTimer();

            widgetHovered.current = false;
            popperHovered.current = false;

            setBackdropOpen(true);
            backdropOpened.current = true;
        },

        close: () => {
            widgetHovered.current = false;
            scheduleClose();
        },
    }), []);

    const imageSrc =
        `/api/file/image?uid=${encodeURIComponent(uid)}&src=${encodeURIComponent(info?.src || "")}`;

    const virtualAnchor = info
        ? {
            // PopoverVirtualElement 需要这个
            nodeType: 1,

            getBoundingClientRect: () => info.anchor,

            // 给 Popper 一个上下文元素，计算 viewport boundary 时更稳定
            contextElement: document.body,
        }
        : null;

    const component = info && (
        <>
            <Popper
                open={!backdropOpen}
                anchorEl={virtualAnchor}
                placement="bottom-start"
                modifiers={[
                    {
                        name: "offset",
                        options: {
                            offset: [0, 6],
                        },
                    },
                    {
                        name: "flip",
                        options: {
                            boundary: "viewport",
                            rootBoundary: "viewport",

                            // 不要只允许 top
                            fallbackPlacements: [
                                "top-start",
                                "bottom-end",
                                "top-end",
                                "right-start",
                                "right-end",
                                "left-start",
                                "left-end",
                            ],

                            padding: 8,
                        },
                    },
                    {
                        name: "preventOverflow",
                        options: {
                            boundary: "viewport",
                            rootBoundary: "viewport",
                            padding: 8,

                            // 允许在另一条轴上移动
                            altAxis: true,

                            // 不要强行把 anchor 和 popup 连在一起
                            tether: true,
                        },
                    },
                ]}
                sx={{
                    zIndex: (t) => t.zIndex.tooltip,
                    cursor: "zoom-in",
                }}
                onMouseEnter={() => {
                    popperHovered.current = true;
                    clearCloseTimer();
                }}
                onMouseLeave={() => {
                    popperHovered.current = false;
                    scheduleClose();
                }}
                onClick={() => {
                    clearCloseTimer();

                    widgetHovered.current = false;
                    popperHovered.current = false;

                    setBackdropOpen(true);
                    backdropOpened.current = true;
                }}
            >
                <Paper elevation={13}>
                    <Box
                        component="img"
                        src={imageSrc}
                        alt={info.alt}
                        sx={{
                            display: "block",
                            maxWidth: 388,
                            maxHeight: 388,
                            objectFit: "contain",
                        }}
                    />
                </Paper>
            </Popper>

            <Backdrop
                open={backdropOpen}
                onClick={() => {
                    backdropOpened.current = false;
                    setBackdropOpen(false);
                    setInfo(null);
                }}
                sx={{
                    zIndex: (t) => t.zIndex.modal + 1,
                }}
            >
                <Box
                    component="img"
                    src={imageSrc}
                    alt={info.alt}
                    sx={{
                        width: "100%",
                        height: "100%",
                        display: "block",
                        objectFit: "contain",
                        cursor: "zoom-out",
                    }}
                />
            </Backdrop>
        </>
    );

    return { api, component };
}