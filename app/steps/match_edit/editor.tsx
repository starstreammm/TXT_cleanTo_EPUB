import { Box, Divider, Typography, Skeleton, useMediaQuery } from "@mui/material";
import { useColorScheme } from '@mui/material/styles';

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
    showFileList,
    setShowFileList,
    ref,
}: {
    file: FileInfo | null,
    setFile: Dispatch<SetStateAction<FileInfo>>,
    showFileList: boolean;
    setShowFileList: Dispatch<SetStateAction<boolean>>;
    ref: ForwardedRef<() => Promise<void>>;
}) {
    //const
    const { mode, setMode } = useColorScheme();
    const preferIsDark = useMediaQuery("(prefers-color-scheme: dark)");
    const OrgEditorRef = useRef<editor.IStandaloneCodeEditor>(null);
    const ModEditorRef = useRef<editor.IStandaloneCodeEditor>(null);
    const disposeImagePreviewRef = useRef<() => void>(null);
    const abortControllerRef = useRef<AbortController>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

    // state
    const [loading, setLoading] = useState(false);
    const fetching = useRef(false);
    const [fontSize, setFontSize] = useLocalStorage<number>("editor_font_size", 14);
    const [wordWrap, setWordWrap] = useState(true);
    const [diff, setDiff] = useState(true);
    const [unsave, setUnsave] = useState(false);
    const [unsaveDialog, setUnsaveDialog] = useState(false);
    const [saveDialog, setSaveDialog] = useState(false);
    const resolveUnsave = useRef<((value: boolean) => void) | null>(null);
    const [metaDataDialog, setMetaDataDialog] = useState(false);
    const { api: imagePreviewApi, component: imageComponent } = useImagePreviewPopup(file?.uid || "");

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

        setLoading(true);
        fetching.current = true;
        OrgEditorRef.current?.updateOptions({
            readOnly: true,
        });

        let chunk = "";
        let line = 0;
        for await (const c of getContent(uid)) {
            chunk += c;
            line++;
            if (line % 33 === 0) {
                setLoading(false);
                setContent(chunk);
            }
        }
        setLoading(false);
        setContent(chunk);

        setTimeout(() => {
            fetching.current = false;
            setUnsave(false);
            OrgEditorRef.current?.updateOptions({
                readOnly: false,
            });
        }, 133);
    };

    const handleSave = async () => {
        if (file === null) return;

        setSaveDialog(true);
        try {
            await saveUpdate(
                content,
                OrgEditorRef.current?.getValue() ?? "",
                file.uid,
            )
            setUnsave(false);
            setContent(OrgEditorRef.current?.getValue() ?? "");
        } catch { }
        setSaveDialog(false);
    };



    useEffect(() => {
        fetchContent();
        if (file?.type === "txt") setDiff(true);
        else setDiff(false);
    }, [file?.uid]);

    useEffect(() => {
        requestAnimationFrame(() => {
            OrgEditorRef.current?.layout();
            ModEditorRef.current?.layout();
        });
    }, [fontSize, wordWrap, showFileList, diff]);


    if (file === null)
        return (
            <Box sx={{
                display: "flex",
                width: "100%",
                height: '100%',
                justifyContent: "center",
                alignItems: "center",
            }}>
                <Typography variant="h6" sx={{ color: "text.secondary" }}>
                    Select a file to edit
                </Typography>
            </Box>
        );

    if (loading)
        return (
            <Box sx={{
                display: 'flex',
                width: "100%",
                height: '100%',
                gap: 3,
                p: 3,
            }} >
                <Skeleton variant="rounded" width="50%" height="100%" />
                <Divider orientation="vertical" />
                <Skeleton variant="rounded" width="50%" height="100%" />
            </Box>
        );

    else
        return (
            <Box sx={{
                display: 'flex',
                flexDirection: 'column',
                width: "100%",
                height: '100%',
            }}>
                {saveDialog && <SavingDialog />}
                {unsaveDialog &&
                    <UnSaveDialog
                        onClose={(saved) => {
                            if (saved)
                                resolveUnsave.current?.(true);
                            else
                                resolveUnsave.current?.(false);

                            resolveUnsave.current = null;
                            setUnsaveDialog(false);
                        }}
                    />
                }
                {metaDataDialog &&
                    <MetaDataDialog
                        defaultValue={file}
                        onClose={(newMetaData) => {
                            setMetaDataDialog(false);
                            if (newMetaData) {
                                updateMetaData(file.uid, newMetaData)
                                    .then(() => setFile((prev) => ({
                                        ...prev,
                                        ...newMetaData,
                                    })));
                            }
                        }}
                    />
                }
                <EditorToolBar
                    showFileList={showFileList}
                    setShowFileList={setShowFileList}
                    fontSize={fontSize}
                    setFontSize={setFontSize}
                    wordWrap={wordWrap}
                    setWordWrap={setWordWrap}
                    diff={diff}
                    setDiff={file.type === "txt" ? setDiff : undefined}
                    unsave={unsave}
                    onReset={() => {
                        OrgEditorRef.current?.setValue(content);
                        setUnsave(false);
                    }}
                    onRefresh={() => {
                        const viewState = OrgEditorRef.current?.saveViewState();
                        fetchContent()
                            .then(() => {
                                if (viewState)
                                    OrgEditorRef.current?.restoreViewState(viewState);
                            });
                    }}
                    onSave={() => handleSave()}
                    setMetaData={() => setMetaDataDialog(true)}
                />
                <Divider />
                {imageComponent}
                <Box sx={{
                    width: "100%",
                    height: "100%",
                    flexDirection: 'row',
                    display: 'flex',
                }}>
                    <Editor
                        theme={mode === "dark" || (mode === "system" && preferIsDark) ? "vs-dark" : "vs"}
                        width={diff ? "50%" : "100%"}
                        height="100%"
                        language="markdown"
                        value={content}
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

                            // Key binding for save
                            editor.addCommand(
                                monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
                                () => handleSave(),
                            );

                            // Setup Image Preview
                            disposeImagePreviewRef.current = setupImagePreview(
                                editor,
                                monaco,
                                () => imagePreviewApi,
                            );

                            // Handel Change & Fetch Formated
                            const fetchFormated = () => {
                                if (file.type === "md") return;
                                abortControllerRef.current?.abort();
                                abortControllerRef.current = new AbortController();

                                const range = editor.getVisibleRanges()[0];
                                getFormated(editor.getModel()?.getValueInRange(range) ?? "", abortControllerRef.current.signal)
                                    .then((res) => {
                                        setFormated(res);
                                        ModEditorRef.current?.setScrollTop(0);
                                    })
                            }

                            const handleScroll = () => {
                                if (!diff) return;
                                if (timerRef.current) clearTimeout(timerRef.current);

                                timerRef.current = setTimeout(() => fetchFormated(), 333);
                            }

                            fetchFormated();
                            editor.onDidScrollChange(handleScroll);
                            editor.onDidChangeModelContent(() => {
                                if (!fetching.current) {
                                    setUnsave(true);
                                    handleScroll();
                                }
                            })
                        }}
                    />
                    {diff && file.type === "txt" &&
                        <Editor
                            height="100%"
                            width="50%"
                            value={formated}
                            language="markdown"
                            theme={mode === "dark" || (mode === "system" && preferIsDark) ? "vs-dark" : "vs"}
                            options={{
                                fontSize: fontSize,
                                readOnly: true,
                                wordWrap: wordWrap ? "on" : "off",
                                lineNumbers: "off",
                                smoothScrolling: true,
                                scrollBeyondLastLine: false,
                                minimap: { enabled: false },
                                unicodeHighlight: {
                                    nonBasicASCII: false,
                                    ambiguousCharacters: false,
                                    invisibleCharacters: false,
                                },
                                mouseWheelZoom: false,
                                automaticLayout: true,
                            }}
                            onMount={(editor) => ModEditorRef.current = editor}
                        />
                    }
                </Box>
            </Box >
        );
}
