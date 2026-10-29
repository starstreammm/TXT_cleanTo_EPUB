import { Box, Divider, Fab, Tooltip } from "@mui/material";
import SpellcheckRoundedIcon from "@mui/icons-material/SpellcheckRounded";
import NavigateNextRoundedIcon from "@mui/icons-material/NavigateNextRounded";

import { useEffect, useRef, useState } from "react";

import type { FileInfo } from "~/hooks/models";
import { pushMsg } from "~/components/error_popout";
import FileList from "./list";
import TextEditor from "./editor";
import { fetchFileList } from "./function";

export default function MatchAndEdit({ onNext }: { onNext: () => void }) {
    const [open, setOpen] = useState<string | null>(null);
    const [showFileList, setShowFileList] = useState(true);
    const [files, setFiles] = useState<FileInfo[]>([]);
    const editorRef = useRef<() => Promise<void>>(null);

    useEffect(() => {
        fetchFileList()
            .then((data) => {
                setFiles(data);
                setOpen(data[0]?.uid ?? null);
                setShowFileList(data.length > 1);
            })
            .catch(() => setFiles([]));
    }, []);

    return (
        <Box
            sx={{
                display: "flex",
                width: "100%",
                height: "100%",
            }}
        >
            <Tooltip title="Next Step" placement="right" arrow>
                <Fab
                    size="small"
                    color="secondary"
                    variant="extended"
                    disabled={!files.length}
                    onClick={() => {
                        editorRef
                            .current?.()
                            .then(() => onNext())
                            .catch(() => {
                                // The editor reports save failures and stays open.
                            });
                    }}
                    sx={{
                        position: "absolute",
                        bottom: 13,
                        left: files.length > 1 && showFileList ? 153 : 13,
                        zIndex: 1,
                        gap: 1,
                    }}
                >
                    <SpellcheckRoundedIcon />
                    <NavigateNextRoundedIcon />
                </Fab>
            </Tooltip>
            {files.length > 1 && showFileList && (
                <>
                    <Box
                        sx={{
                            width: 233,
                            flexShrink: 0,
                            height: "100%",
                            overflowY: "auto",
                        }}
                    >
                        <FileList
                            files={files}
                            selectedUid={open}
                            onOpen={(file) => {
                                editorRef
                                    .current?.()
                                    .then(() => setOpen(file.uid))
                                    .catch(() => {
                                        // The editor reports save failures and stays open.
                                    });
                            }}
                        />
                    </Box>
                    <Divider orientation="vertical" />
                </>
            )}
            <Box
                sx={{
                    flex: 1,
                    minWidth: 0,
                    minHeight: 0,
                }}
            >
                <TextEditor
                    key={open}
                    ref={editorRef}
                    file={files.find((file) => file.uid === open) || null}
                    setFile={(
                        action: ((prev: FileInfo) => FileInfo) | FileInfo,
                    ) => {
                        const index = files.findIndex(
                            (file) => file.uid === open,
                        );

                        if (index === -1) {
                            pushMsg("Editor: Invalid UID.", "error");
                            return;
                        }

                        let content: FileInfo;
                        if (typeof action === "function") {
                            content = action(files[index]);
                        } else {
                            content = action;
                        }

                        setFiles((prev) => {
                            const newFiles = [...prev];
                            newFiles[index] = content;
                            return newFiles;
                        });
                    }}
                    hasFileList={files.length > 1}
                    showFileList={files.length > 1 && showFileList}
                    setShowFileList={setShowFileList}
                />
            </Box>
        </Box>
    );
}
