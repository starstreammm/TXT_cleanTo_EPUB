import { Box, Divider, Fab, Tooltip } from "@mui/material";
import SpellcheckRoundedIcon from '@mui/icons-material/SpellcheckRounded';
import NavigateNextRoundedIcon from '@mui/icons-material/NavigateNextRounded';

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
            .then((data) => setFiles(data));
    }, []);


    return (
        <Box sx={{
            display: 'flex',
            width: '100%',
            height: '100%',
        }}>
            <Box sx={{
                display: 'flex',
                flexDirection: 'column',
                width: showFileList ? 233 : 0,
                height: '100%',
                overflowY: 'auto',
            }}>
                <Tooltip title="Next Step" placement="right" arrow>
                    <Fab
                        size="small"
                        color="secondary"
                        variant="extended"
                        onClick={() => {
                            editorRef.current?.()
                                .then(() => onNext());
                        }}
                        sx={{
                            display: showFileList ? 'flex' : 'none',
                            position: 'absolute',
                            bottom: 13,
                            left: 153,
                            gap: 1,
                        }}
                    >
                        <SpellcheckRoundedIcon />
                        <NavigateNextRoundedIcon />
                    </Fab>
                </Tooltip>
                <FileList files={files} onOpen={(file) => {
                    editorRef.current?.()
                        .then(() => setOpen(file.uid));
                }} />
            </Box>
            <Divider orientation="vertical" />
            <Box sx={{
                flex: 1,
                minWidth: 0,
                minHeight: 0,
            }}>
                <TextEditor
                    ref={editorRef}
                    file={files.find((file) => file.uid === open) || null}
                    setFile={(action: ((prev: FileInfo) => FileInfo) | FileInfo) => {
                        const index = files.findIndex((file) => file.uid === open);

                        if (index === -1) {
                            pushMsg("Editor: Invalid UID.", "error");
                            return;
                        }

                        let content: FileInfo;
                        if (typeof action === 'function') {
                            content = action(files[index]);
                        }
                        else {
                            content = action;
                        }

                        setFiles((prev) => {
                            const newFiles = [...prev];
                            newFiles[index] = content;
                            return newFiles;
                        });
                    }}
                    showFileList={showFileList}
                    setShowFileList={setShowFileList}
                />
            </Box>
        </Box>
    )
}