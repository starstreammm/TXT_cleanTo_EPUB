import { Backdrop, Box } from "@mui/material";
import { useState } from "react";
import type * as Monaco from "monaco-editor";

interface ImagePreviewInfo {
    src: string;
    alt: string;
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
    onPreview: (info: ImagePreviewInfo) => void,
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

        dom.onclick = () => onPreview({ src, alt });

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
    };
}

export function useImagePreviewPopup(uid: string) {
    const [info, setInfo] = useState<ImagePreviewInfo | null>(null);

    const component = info && (
        <Backdrop
            open
            onClick={() => setInfo(null)}
            sx={{
                zIndex: (t) => t.zIndex.modal + 1,
            }}
        >
            <Box
                component="img"
                src={`/api/file/image?${new URLSearchParams({ uid, src: info.src })}`}
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
    );

    return { open: setInfo, component };
}
