import {
    Box,
    Button,
    Paper,
    Typography,
    List,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Checkbox,
    Alert,
} from "@mui/material";
import NavigateNextRoundedIcon from "@mui/icons-material/NavigateNextRounded";
import EditNoteRoundedIcon from "@mui/icons-material/EditNoteRounded";
import { useRef, useState } from "react";
import { api } from "~/hooks/api";
import type { FileInfo } from "~/hooks/models";
import { useLocalStorage } from "~/hooks/storage";
import { pushError } from "~/components/error_popout";
import PathSelector from "~/components/pathselector";
import PatternDialog from "~/components/pattern";

export default function PathSelect({ onNext }: { onNext: () => void }) {
    const [workDir, setWorkDir] = useLocalStorage<string>("work_dir", "");
    const [loading, setLoading] = useState(false);
    const [pattern, setPattern] = useState(false);
    const [files, setFiles] = useState<FileInfo[] | null>(null);
    const [selected, setSelected] = useState<string[]>([]);
    const [loadedPath, setLoadedPath] = useState("");
    const requestRef = useRef(0);
    const currentList = files !== null && loadedPath === workDir;

    const loadFiles = async (path: string) => {
        const request = ++requestRef.current;
        setLoading(true);
        try {
            const result = await api
                .post("/api/file/work_dir", {
                    searchParams: { path },
                })
                .json<FileInfo[]>();
            if (request !== requestRef.current) return;
            setFiles(result);
            setSelected(result.map((file) => file.uid));
            setLoadedPath(path);
        } catch (error) {
            pushError(error, "Load files");
        } finally {
            if (request === requestRef.current) setLoading(false);
        }
    };

    const handleNext = async () => {
        if (!currentList) {
            await loadFiles(workDir);
            return;
        }
        setLoading(true);
        try {
            await api.post("/api/file/selection", { json: selected });
            onNext();
        } catch (error) {
            pushError(error, "Select files");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box
            sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                width: "100%",
                height: "100%",
            }}
        >
            <Paper
                elevation={13}
                sx={{
                    width: "88%",
                    height: "88%",
                    p: 8,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-end",
                    gap: 3,
                }}
            >
                {pattern && (
                    <PatternDialog
                        exclude={["chapter", "adv", "volume"]}
                        onClose={() => {
                            setPattern(false);
                            setFiles(null);
                        }}
                    />
                )}
                <Button
                    variant="outlined"
                    startIcon={<EditNoteRoundedIcon />}
                    onClick={() => setPattern(true)}
                >
                    Edit File Name Matching Pattern
                </Button>
                <PathSelector
                    label="Work Directory or File"
                    includeFiles
                    value={workDir}
                    onClose={setWorkDir}
                    onEnter={(path) => {
                        setWorkDir(path);
                        if (!loading) void loadFiles(path);
                    }}
                />
                {currentList && (
                    <Box
                        sx={{
                            width: "100%",
                            flex: 1,
                            minHeight: 0,
                            display: "flex",
                            flexDirection: "column",
                        }}
                    >
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                            }}
                        >
                            <Checkbox
                                checked={
                                    files.length > 0 &&
                                    selected.length === files.length
                                }
                                indeterminate={
                                    selected.length > 0 &&
                                    selected.length < files.length
                                }
                                disabled={!files.length || loading}
                                onChange={(_, checked) =>
                                    setSelected(
                                        checked
                                            ? files.map((file) => file.uid)
                                            : [],
                                    )
                                }
                                slotProps={{
                                    input: { "aria-label": "Select all files" },
                                }}
                            />
                            <Typography>
                                {selected.length} of {files.length} files will
                                be processed
                            </Typography>
                            <Button
                                sx={{ ml: "auto" }}
                                disabled={loading}
                                onClick={() => void loadFiles(workDir)}
                            >
                                Refresh
                            </Button>
                        </Box>
                        {!files.length && (
                            <Alert severity="info">
                                No .txt or .md files found.
                            </Alert>
                        )}
                        <List sx={{ overflowY: "auto", flex: 1 }}>
                            {files.map((file) => (
                                <ListItemButton
                                    key={file.uid}
                                    disabled={loading}
                                    onClick={() =>
                                        setSelected((previous) =>
                                            previous.includes(file.uid)
                                                ? previous.filter(
                                                      (uid) => uid !== file.uid,
                                                  )
                                                : [...previous, file.uid],
                                        )
                                    }
                                >
                                    <ListItemIcon>
                                        <Checkbox
                                            edge="start"
                                            checked={selected.includes(
                                                file.uid,
                                            )}
                                            tabIndex={-1}
                                            disableRipple
                                            slotProps={{
                                                input: {
                                                    "aria-label": `Select ${file.source_name}`,
                                                },
                                            }}
                                        />
                                    </ListItemIcon>
                                    <ListItemText
                                        primary={file.source_name}
                                        secondary={file.title}
                                        sx={{ overflowWrap: "anywhere" }}
                                    />
                                </ListItemButton>
                            ))}
                        </List>
                    </Box>
                )}
                <Button
                    variant="contained"
                    loading={loading}
                    disabled={currentList && !selected.length}
                    onClick={() => void handleNext()}
                    endIcon={<NavigateNextRoundedIcon />}
                    sx={{ mt: "auto" }}
                >
                    {currentList ? "Next" : "Preview Files"}
                </Button>
            </Paper>
        </Box>
    );
}
