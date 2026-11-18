import { useNavigate } from "react-router";
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
} from "@mui/material";
import NavigateNextRoundedIcon from "@mui/icons-material/NavigateNextRounded";
import EditNoteRoundedIcon from "@mui/icons-material/EditNoteRounded";
import { useRef, useState } from "react";
import { api } from "~/hooks/api";
import type { FileInfo } from "~/hooks/models";
import { useLocalStorage } from "~/hooks/storage";
import { pushError } from "~/components/error_popout";
import PathSelector from "~/components/pathselector";
import FilenamePatternDialog from "./pattern";
import { formatFileSize } from "./function";

export default function PathSelect() {
    const navigate = useNavigate();
    const [workDir, setWorkDir] = useLocalStorage<string>("work_dir", "");
    const [loading, setLoading] = useState(false);
    const [pattern, setPattern] = useState(false);
    const [files, setFiles] = useState<FileInfo[] | null>(null);
    const [selected, setSelected] = useState<string[]>([]);
    const [loadedPath, setLoadedPath] = useState("");
    const requestRef = useRef(0);
    const currentList = files !== null && loadedPath === workDir;

    const loadFiles = async (path: string, selectedNames?: Set<string>) => {
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
            setSelected(
                result
                    .filter(
                        (file) =>
                            !selectedNames ||
                            selectedNames.has(file.source_name),
                    )
                    .map((file) => file.uid),
            );
            setLoadedPath(path);
        } catch (error) {
            if (request === requestRef.current && selectedNames) setFiles(null);
            pushError(error, "Load files");
        } finally {
            if (request === requestRef.current) setLoading(false);
        }
    };

    const refreshMatches = async () => {
        if (!currentList) {
            setFiles(null);
            return;
        }
        const selectedNames = new Set(
            files
                .filter((file) => selected.includes(file.uid))
                .map((file) => file.source_name),
        );
        await loadFiles(workDir, selectedNames);
    };

    const handleNext = async () => {
        if (!currentList) {
            await loadFiles(workDir);
            return;
        }
        setLoading(true);
        try {
            await api.post("/api/file/selection", { json: selected });
            void navigate("/match-edit");
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
                flexDirection: "column",
                alignItems: "flex-end",
                width: "100%",
                height: "100%",
                gap: 1,
                p: 3,
            }}
        >
            {pattern && (
                <FilenamePatternDialog
                    onClose={() => setPattern(false)}
                    onPatternsChanged={refreshMatches}
                />
            )}
            <Box
                sx={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                }}
            >
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
                <Button
                    variant="outlined"
                    startIcon={<EditNoteRoundedIcon />}
                    disabled={loading}
                    onClick={() => setPattern(true)}
                    sx={{ Shrink: 0, flexShrink: 0 }}
                >
                    Edit Match
                </Button>
            </Box>
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
                            {selected.length} of {files.length} files will be
                            processed
                        </Typography>
                    </Box>
                    {!files.length && (
                        <Typography color="text.secondary">
                            No .txt or .md files found.
                        </Typography>
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
                                        checked={selected.includes(file.uid)}
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
                                    secondary={
                                        <Box
                                            sx={{
                                                display: "grid",
                                                gridTemplateColumns:
                                                    "repeat(5, minmax(0, 1fr))",
                                                gap: 2,
                                                width: "100%",
                                            }}
                                        >
                                            <Box
                                                sx={{
                                                    minWidth: 0,
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                    whiteSpace: "nowrap",
                                                }}
                                            >
                                                Title: {file.title}
                                            </Box>
                                            <Box
                                                sx={{
                                                    minWidth: 0,
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                    whiteSpace: "nowrap",
                                                }}
                                            >
                                                Author:{" "}
                                                {file.creator || "Not matched"}
                                            </Box>
                                            <Box
                                                sx={{
                                                    minWidth: 0,
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                    whiteSpace: "nowrap",
                                                }}
                                            >
                                                Size:{" "}
                                                {formatFileSize(file.size)}
                                            </Box>
                                            <Box
                                                sx={{
                                                    minWidth: 0,
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                    whiteSpace: "nowrap",
                                                }}
                                            >
                                                Last modified:{" "}
                                                {new Date(
                                                    file.modified_at,
                                                ).toLocaleString()}
                                            </Box>
                                        </Box>
                                    }
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
        </Box>
    );
}
