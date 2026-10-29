import { useState } from "react";
import {
    Box,
    Button,
    Divider,
    IconButton,
    Paper,
    TextField,
    Tooltip,
    Typography,
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import { useLocalStorage } from "~/hooks/storage";

interface Replacement {
    id: string;
    original: string;
    replacement: string;
}

export default function Replacements({
    onRun,
    onClose,
}: {
    onRun: (original: string, replacement: string) => void;
    onClose: () => void;
}) {
    const [pairs, setPairs] = useLocalStorage<Replacement[]>(
        "editor_replacements_v1",
        [],
    );
    const [editing, setEditing] = useState<string | null>(null);
    const [original, setOriginal] = useState("");
    const [replacement, setReplacement] = useState("");

    const clear = () => {
        setEditing(null);
        setOriginal("");
        setReplacement("");
    };

    const save = () => {
        const pair = {
            id: editing ?? crypto.getRandomValues(new Uint32Array(2)).join("-"),
            original,
            replacement,
        };
        setPairs((previous) =>
            editing
                ? previous.map((item) => (item.id === editing ? pair : item))
                : [...previous, pair],
        );
        clear();
    };

    return (
        <Paper
            square
            elevation={0}
            sx={{
                width: 300,
                flexShrink: 0,
                borderLeft: 1,
                borderColor: "divider",
                display: "flex",
                flexDirection: "column",
                overflowY: "auto",
                p: 2,
                gap: 2,
            }}
        >
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                }}
            >
                <Typography variant="subtitle1">Saved Replacements</Typography>
                <IconButton
                    size="small"
                    aria-label="Close saved replacements"
                    onClick={onClose}
                >
                    <CloseRoundedIcon />
                </IconButton>
            </Box>
            <Typography variant="body2" color="text.secondary">
                Replace all exact matches in the source editor. Changes can be
                undone before saving.
            </Typography>
            <TextField
                label="Original text"
                value={original}
                onChange={(event) => setOriginal(event.target.value)}
                multiline
                minRows={2}
                size="small"
            />
            <TextField
                label="Replacement text"
                value={replacement}
                onChange={(event) => setReplacement(event.target.value)}
                multiline
                minRows={2}
                size="small"
                helperText="Leave empty to remove matching text."
            />
            <Box sx={{ display: "flex", gap: 1 }}>
                <Button variant="outlined" disabled={!original} onClick={save}>
                    {editing ? "Save Pair" : "Add Pair"}
                </Button>
                {editing && <Button onClick={clear}>Cancel</Button>}
            </Box>
            <Divider />
            {!pairs.length && (
                <Typography variant="body2" color="text.secondary">
                    No saved replacements yet.
                </Typography>
            )}
            {pairs.map((pair) => (
                <Box
                    key={pair.id}
                    sx={{
                        border: 1,
                        borderColor: "divider",
                        borderRadius: 1,
                        p: 1,
                    }}
                >
                    <Typography
                        variant="body2"
                        sx={{
                            whiteSpace: "pre-wrap",
                            overflowWrap: "anywhere",
                        }}
                    >
                        {pair.original}
                    </Typography>
                    <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                            whiteSpace: "pre-wrap",
                            overflowWrap: "anywhere",
                            mt: 1,
                        }}
                    >
                        → {pair.replacement || "(delete)"}
                    </Typography>
                    <Box
                        sx={{
                            display: "flex",
                            justifyContent: "flex-end",
                            mt: 1,
                        }}
                    >
                        <Tooltip title="Run">
                            <IconButton
                                size="small"
                                aria-label="Run replacement"
                                onClick={() =>
                                    onRun(pair.original, pair.replacement)
                                }
                            >
                                <PlayArrowRoundedIcon color="primary" />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit">
                            <IconButton
                                size="small"
                                aria-label="Edit replacement"
                                onClick={() => {
                                    setEditing(pair.id);
                                    setOriginal(pair.original);
                                    setReplacement(pair.replacement);
                                }}
                            >
                                <EditRoundedIcon />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                            <IconButton
                                size="small"
                                aria-label="Delete replacement"
                                onClick={() => {
                                    setPairs((previous) =>
                                        previous.filter(
                                            (item) => item.id !== pair.id,
                                        ),
                                    );
                                    if (editing === pair.id) clear();
                                }}
                            >
                                <DeleteOutlineRoundedIcon color="error" />
                            </IconButton>
                        </Tooltip>
                    </Box>
                </Box>
            ))}
        </Paper>
    );
}
