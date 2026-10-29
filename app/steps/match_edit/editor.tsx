import {
    Box,
    Divider,
    Typography,
    Skeleton,
    Alert,
    Button,
    useMediaQuery,
} from "@mui/material";
import { useColorScheme } from "@mui/material/styles";

import { Editor } from "@monaco-editor/react";
import type { editor } from "monaco-editor";

import {
    useRef,
    useEffect,
    useState,
    useImperativeHandle,
    type Dispatch,
    type SetStateAction,
    type ForwardedRef,
} from "react";

import MarkdownPreview from "./preview";
import Replacements from "./replacements";
import { pushMsg } from "~/components/error_popout";
import type { FileInfo } from "~/hooks/models";
import { useLocalStorage } from "~/hooks/storage";
import { EditorToolBar } from "./toolbar";
import { getContent, getFormated, updateMetaData } from "./function";
import MetaDataDialog from "./metadata";
import { saveUpdate, UnSaveDialog, SavingDialog } from "./save_update";
import { setupImagePreview, useImagePreviewPopup } from "./image_preview";

export default function TextEditor({
    file,
    setFile,
    hasFileList,
    showFileList,
    setShowFileList,
    ref,
}: {
    file: FileInfo | null;
    setFile: Dispatch<SetStateAction<FileInfo>>;
    hasFileList: boolean;
    showFileList: boolean;
    setShowFileList: Dispatch<SetStateAction<boolean>>;
    ref: ForwardedRef<() => Promise<void>>;
}) {
    //const
    const { mode } = useColorScheme();
    const preferIsDark = useMediaQuery("(prefers-color-scheme: dark)");
    const OrgEditorRef = useRef<editor.IStandaloneCodeEditor>(null);
    const disposeImagePreviewRef = useRef<() => void>(null);
    const savedContentRef = useRef("");
    const contentRequestRef = useRef(0);
    const pendingSaveRef = useRef<Promise<void> | null>(null);

    // state
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [sourceEditor, setSourceEditor] =
        useState<editor.IStandaloneCodeEditor | null>(null);
    const fetching = useRef(false);
    const [fontSize, setFontSize] = useLocalStorage<number>(
        "editor_font_size",
        14,
    );
    const [wordWrap, setWordWrap] = useState(true);
    const [diff, setDiff] = useState(true);
    const [showReplacements, setShowReplacements] = useState(false);
    const [previewVersion, setPreviewVersion] = useState(0);
    const [unsave, setUnsave] = useState(false);
    const [unsaveDialog, setUnsaveDialog] = useState(false);
    const [saveDialog, setSaveDialog] = useState(false);
    const resolveUnsave = useRef<((value: boolean) => void) | null>(null);
    const [metaDataDialog, setMetaDataDialog] = useState(false);
    const { api: imagePreviewApi, component: imageComponent } =
        useImagePreviewPopup(file?.uid || "");

    // data
    const [content, setContent] = useState<string>("");
    const [formated, setFormated] = useState<string>("");

    useImperativeHandle(ref, () => async () => {
        if (unsave) {
            setUnsaveDialog(true);

            const confirmed = await new Promise<boolean>((resolve) => {
                resolveUnsave.current = resolve;
            });

            if (confirmed) {
                await handleSave();
            }
        }
    });

    const fetchContent = async (uid = file?.uid) => {
        if (!uid) return;

        const request = ++contentRequestRef.current;
        setSourceEditor(null);
        setLoading(true);
        setLoadError(null);
        fetching.current = true;
        try {
            let chunk = "";
            for await (const part of getContent(uid)) {
                if (request !== contentRequestRef.current) return;
                chunk += part;
            }
            if (request !== contentRequestRef.current) return;
            savedContentRef.current = chunk;
            setContent(chunk);
            setUnsave(false);
        } catch (error) {
            if (request === contentRequestRef.current) {
                setLoadError(
                    error instanceof Error
                        ? error.message
                        : "Unable to open this file.",
                );
            }
        } finally {
            if (request === contentRequestRef.current) {
                fetching.current = false;
                setLoading(false);
            }
        }
    };

    const handleSave = async () => {
        if (pendingSaveRef.current) return pendingSaveRef.current;
        const editor = OrgEditorRef.current;
        if (file === null || !editor || fetching.current) return;

        const snapshot = editor.getValue();
        setSaveDialog(true);
        pendingSaveRef.current = (async () => {
            try {
                await saveUpdate(savedContentRef.current, snapshot, file.uid);
                savedContentRef.current = snapshot;
                const hasNewEdits = editor.getValue() !== snapshot;
                setUnsave(hasNewEdits);
                // Updating the controlled value must not overwrite edits made during the request.
                if (!hasNewEdits) setContent(snapshot);
            } finally {
                pendingSaveRef.current = null;
                setSaveDialog(false);
            }
        })();
        return pendingSaveRef.current;
    };

    const handleSaveRef = useRef(handleSave);
    useEffect(() => {
        handleSaveRef.current = handleSave;
    }, [handleSave]);

    useEffect(() => {
        void fetchContent();
        return () => {
            contentRequestRef.current++;
        };
    }, [file?.uid]);

    useEffect(() => {
        requestAnimationFrame(() => {
            OrgEditorRef.current?.layout();
        });
    }, [fontSize, wordWrap, showFileList, diff, showReplacements]);

    useEffect(() => {
        if (!file || !diff || loading || loadError || !sourceEditor) return;
        let controller: AbortController | undefined;
        let timer: ReturnType<typeof setTimeout>;
        const refreshPreview = () => {
            clearTimeout(timer);
            controller?.abort();
            timer = setTimeout(() => {
                const model = sourceEditor.getModel();
                const ranges = sourceEditor.getVisibleRanges();
                if (!model || !ranges.length) {
                    setFormated("");
                    return;
                }
                const visibleContent = ranges
                    .map((range) => model.getValueInRange(range))
                    .join("\n");
                const request = new AbortController();
                controller = request;
                getFormated(visibleContent, file.type, request.signal)
                    .then((result) => {
                        if (!request.signal.aborted) setFormated(result);
                    })
                    .catch(() => {
                        // getFormated reports request errors; canceled requests are expected.
                    });
            }, 333);
        };
        const subscriptions = [
            sourceEditor.onDidScrollChange(refreshPreview),
            sourceEditor.onDidChangeModelContent(refreshPreview),
            sourceEditor.onDidLayoutChange(refreshPreview),
            sourceEditor.onDidChangeConfiguration(refreshPreview),
        ];
        refreshPreview();
        return () => {
            subscriptions.forEach((subscription) => subscription.dispose());
            clearTimeout(timer);
            controller?.abort();
        };
    }, [
        sourceEditor,
        file?.uid,
        file?.type,
        diff,
        previewVersion,
        loading,
        loadError,
    ]);

    useEffect(() => () => disposeImagePreviewRef.current?.(), []);

    const runReplacement = (original: string, replacement: string) => {
        const sourceEditor = OrgEditorRef.current;
        const model = sourceEditor?.getModel();
        if (!sourceEditor || !model || fetching.current) return;
        const matches = model.findMatches(
            original,
            false,
            false,
            true,
            null,
            false,
            Number.MAX_SAFE_INTEGER,
        );
        if (!matches.length) {
            pushMsg("No matching text found", "info");
            return;
        }
        sourceEditor.pushUndoStop();
        sourceEditor.executeEdits(
            "saved-replacement",
            matches.map((match) => ({
                range: match.range,
                text: replacement,
            })),
        );
        sourceEditor.pushUndoStop();
        sourceEditor.focus();
        pushMsg(`Replaced ${matches.length} matches`, "success");
    };

    if (file === null)
        return (
            <Box
                sx={{
                    display: "flex",
                    width: "100%",
                    height: "100%",
                    justifyContent: "center",
                    alignItems: "center",
                }}
            >
                <Typography variant="h6" sx={{ color: "text.secondary" }}>
                    Select a file to edit
                </Typography>
            </Box>
        );

    if (loadError) {
        return (
            <Alert
                severity="error"
                action={
                    <Button onClick={() => void fetchContent()}>Retry</Button>
                }
            >
                {loadError}
            </Alert>
        );
    }

    if (loading)
        return (
            <Box
                sx={{
                    display: "flex",
                    width: "100%",
                    height: "100%",
                    gap: 3,
                    p: 3,
                }}
            >
                <Skeleton variant="rounded" width="50%" height="100%" />
                <Divider orientation="vertical" />
                <Skeleton variant="rounded" width="50%" height="100%" />
            </Box>
        );
    else
        return (
            <Box
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    width: "100%",
                    height: "100%",
                }}
            >
                {saveDialog && <SavingDialog />}
                {unsaveDialog && (
                    <UnSaveDialog
                        onClose={(saved) => {
                            if (saved) resolveUnsave.current?.(true);
                            else resolveUnsave.current?.(false);

                            resolveUnsave.current = null;
                            setUnsaveDialog(false);
                        }}
                    />
                )}
                {metaDataDialog && (
                    <MetaDataDialog
                        defaultValue={file}
                        onClose={(newMetaData) => {
                            setMetaDataDialog(false);
                            if (newMetaData) {
                                updateMetaData(file.uid, newMetaData).then(() =>
                                    setFile((prev) => ({
                                        ...prev,
                                        ...newMetaData,
                                    })),
                                );
                            }
                        }}
                    />
                )}
                <EditorToolBar
                    hasFileList={hasFileList}
                    showReplacements={showReplacements}
                    onToggleReplacements={() =>
                        setShowReplacements((previous) => !previous)
                    }
                    onPatternClose={() =>
                        setPreviewVersion((previous) => previous + 1)
                    }
                    showFileList={showFileList}
                    setShowFileList={setShowFileList}
                    fontSize={fontSize}
                    setFontSize={setFontSize}
                    wordWrap={wordWrap}
                    setWordWrap={setWordWrap}
                    diff={diff}
                    setDiff={setDiff}
                    unsave={unsave}
                    onReset={() => {
                        OrgEditorRef.current?.setValue(savedContentRef.current);
                        setUnsave(false);
                    }}
                    onRefresh={() => {
                        const viewState = OrgEditorRef.current?.saveViewState();
                        fetchContent().then(() => {
                            if (viewState)
                                OrgEditorRef.current?.restoreViewState(
                                    viewState,
                                );
                        });
                    }}
                    onSave={() => {
                        void handleSave().catch(() => {
                            // saveUpdate already reports the error; keep unsaved edits.
                        });
                    }}
                    setMetaData={() => setMetaDataDialog(true)}
                />
                <Divider />
                {imageComponent}
                <Box
                    sx={{
                        width: "100%",
                        flex: 1,
                        minHeight: 0,
                        flexDirection: "row",
                        display: "flex",
                    }}
                >
                    <Box sx={{ display: "flex", flex: 1, minWidth: 0 }}>
                        <Editor
                            key={file.uid}
                            theme={
                                mode === "dark" ||
                                (mode === "system" && preferIsDark)
                                    ? "vs-dark"
                                    : "vs"
                            }
                            width={diff ? "50%" : "100%"}
                            height="100%"
                            language="markdown"
                            value={content}
                            onChange={(value) => {
                                setContent(value ?? "");
                                if (!fetching.current)
                                    setUnsave(
                                        (value ?? "") !==
                                            savedContentRef.current,
                                    );
                            }}
                            options={{
                                fontSize: fontSize,
                                wordWrap: wordWrap ? "on" : "off",
                                lineNumbers: "on",
                                smoothScrolling: true,
                                scrollBeyondLastLine: false,
                                minimap: { enabled: false },
                                renderLineHighlight: "none",
                                renderWhitespace: "none",
                                lineNumbersMinChars: 3,
                                mouseWheelZoom: false,
                                unicodeHighlight: {
                                    nonBasicASCII: false,
                                    ambiguousCharacters: false,
                                    invisibleCharacters: false,
                                },
                                automaticLayout: true,
                            }}
                            onMount={(editor, monaco) => {
                                OrgEditorRef.current = editor;
                                setSourceEditor(editor);

                                // Key binding for save
                                editor.addCommand(
                                    monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
                                    () => {
                                        void handleSaveRef
                                            .current()
                                            .catch(() => {
                                                // saveUpdate already reports the error; keep unsaved edits.
                                            });
                                    },
                                );

                                // Setup Image Preview
                                disposeImagePreviewRef.current?.();
                                disposeImagePreviewRef.current =
                                    setupImagePreview(
                                        editor,
                                        monaco,
                                        () => imagePreviewApi,
                                    );
                            }}
                        />
                        {diff && (
                            <MarkdownPreview
                                content={formated}
                                uid={file.uid}
                                fontSize={fontSize}
                                dark={
                                    mode === "dark" ||
                                    (mode === "system" && preferIsDark)
                                }
                            />
                        )}
                    </Box>
                    {showReplacements && (
                        <Replacements
                            onRun={runReplacement}
                            onClose={() => setShowReplacements(false)}
                        />
                    )}
                </Box>
            </Box>
        );
}
