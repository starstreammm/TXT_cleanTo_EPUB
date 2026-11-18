import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import DoneAllRoundedIcon from "@mui/icons-material/DoneAllRounded";
import FindReplaceRoundedIcon from "@mui/icons-material/FindReplaceRounded";
import { api } from "~/hooks/api";
import { pushError } from "~/components/error_popout";

interface MatchingOptions {
    matchCase: boolean;
    wholeWord: boolean;
    isRegex: boolean;
}

const defaultOptions: MatchingOptions = {
    matchCase: true,
    wholeWord: false,
    isRegex: false,
};

const matchingOptions = [
    { key: "matchCase", label: "Match case", symbol: "Aa" },
    { key: "wholeWord", label: "Match whole word", symbol: "ab" },
    { key: "isRegex", label: "Use regular expressions", symbol: ".*" },
] as const;

export interface Replacement extends Partial<MatchingOptions> {
    id: string;
    original: string;
    replacement: string;
}

const replacementsKey = ["saved-replacements"];
const replacementsUrl = "/api/replacement";

async function loadReplacements(): Promise<Replacement[]> {
    const legacyKey = "editor_replacements_v1";
    try {
        const legacy = localStorage.getItem(legacyKey);
        if (legacy !== null) {
            await api.post(`${replacementsUrl}/import`, {
                json: JSON.parse(legacy),
            });
            localStorage.removeItem(legacyKey);
        }
    } catch (error) {
        pushError(
            error,
            "Could not migrate browser replacements; browser data retained",
        );
    }
    return api.get(replacementsUrl).json<Replacement[]>();
}

export default function Replacements({
    onApply,
    onClose,
}: {
    onApply: (pair: Replacement, action: "all" | "show") => Promise<void>;
    onClose: () => void;
}) {
    const queryClient = useQueryClient();
    const query = useQuery({
        queryKey: replacementsKey,
        meta: { errorContext: "Load saved replacements" },
        queryFn: loadReplacements,
        retry: false,
    });
    const pairs = query.data ?? [];
    const mutation = useMutation({
        mutationFn: async (action: Replacement | string) => {
            if (typeof action === "string") {
                return api
                    .delete(`${replacementsUrl}/${encodeURIComponent(action)}`)
                    .json<Replacement[]>();
            }
            if (action.isRegex) new RegExp(action.original, "mu");
            return api
                .post(replacementsUrl, { json: action })
                .json<Replacement[]>();
        },
        onSuccess: (saved) => queryClient.setQueryData(replacementsKey, saved),
        onError: (error) => pushError(error, "Save replacements"),
        onSettled: () =>
            queryClient.invalidateQueries({ queryKey: replacementsKey }),
    });
    const busy =
        query.isPending ||
        query.isFetching ||
        query.isError ||
        mutation.isPending;
    const [editing, setEditing] = useState<string | null>(null);
    const [original, setOriginal] = useState("");
    const [replacement, setReplacement] = useState("");
    const [options, setOptions] = useState(defaultOptions);
    const [applying, setApplying] = useState(false);
    const clear = () => {
        setEditing(null);
        setOriginal("");
        setReplacement("");
        setOptions(defaultOptions);
    };

    const save = () => {
        const pair = {
            id: editing ?? crypto.getRandomValues(new Uint32Array(2)).join("-"),
            original,
            replacement,
            ...options,
        };
        mutation.mutate(pair, { onSuccess: clear });
    };

    const apply = async (pair: Replacement, action: "all" | "show") => {
        setApplying(true);
        try {
            await onApply(pair, action);
        } finally {
            setApplying(false);
        }
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
            <TextField
                label="Original text"
                disabled={mutation.isPending}
                value={original}
                onChange={(event) => setOriginal(event.target.value)}
                multiline
                minRows={2}
                size="small"
            />
            <MatchingOptionButtons
                value={options}
                onChange={setOptions}
                disabled={mutation.isPending}
            />
            <TextField
                label="Replacement text"
                disabled={mutation.isPending}
                value={replacement}
                onChange={(event) => setReplacement(event.target.value)}
                multiline
                minRows={2}
                size="small"
                helperText={
                    options.isRegex
                        ? "Use $1, $2, etc. for capture groups. Leave empty to delete."
                        : "Leave empty to remove matching text."
                }
            />
            <Box sx={{ display: "flex", gap: 1 }}>
                <Button
                    variant="outlined"
                    disabled={busy || !original}
                    onClick={save}
                >
                    {editing ? "Save Pair" : "Add Pair"}
                </Button>
                {editing && (
                    <Button disabled={mutation.isPending} onClick={clear}>
                        Cancel
                    </Button>
                )}
            </Box>
            <Divider />
            {query.isSuccess && !pairs.length && (
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
                    <MatchingOptionButtons
                        value={pair}
                        disabled={busy}
                        onChange={(newOptions) =>
                            mutation.mutate({ ...pair, ...newOptions })
                        }
                    />
                    <Box
                        sx={{
                            display: "flex",
                            justifyContent: "flex-end",
                            mt: 1,
                        }}
                    >
                        <Tooltip title="Replace all — apply this pair to the entire source file">
                            <span>
                                <IconButton
                                    size="small"
                                    aria-label="Replace all"
                                    disabled={applying || busy}
                                    onClick={() => void apply(pair, "all")}
                                >
                                    <DoneAllRoundedIcon color="primary" />
                                </IconButton>
                            </span>
                        </Tooltip>
                        <Tooltip title="Show replace in Monaco editor — review matches without changing text">
                            <span>
                                <IconButton
                                    size="small"
                                    aria-label="Show replace in Monaco editor"
                                    disabled={applying || busy}
                                    onClick={() => void apply(pair, "show")}
                                >
                                    <FindReplaceRoundedIcon />
                                </IconButton>
                            </span>
                        </Tooltip>
                        <Tooltip title="Edit">
                            <IconButton
                                size="small"
                                aria-label="Edit replacement"
                                disabled={busy}
                                onClick={() => {
                                    setEditing(pair.id);
                                    setOriginal(pair.original);
                                    setReplacement(pair.replacement);
                                    setOptions({
                                        matchCase: pair.matchCase ?? true,
                                        wholeWord: pair.wholeWord ?? false,
                                        isRegex: pair.isRegex ?? false,
                                    });
                                }}
                            >
                                <EditRoundedIcon />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                            <IconButton
                                size="small"
                                aria-label="Delete replacement"
                                color="error"
                                disabled={busy}
                                onClick={() => {
                                    mutation.mutate(pair.id, {
                                        onSuccess: () => {
                                            if (editing === pair.id) clear();
                                        },
                                    });
                                }}
                            >
                                <DeleteOutlineRoundedIcon />
                            </IconButton>
                        </Tooltip>
                    </Box>
                </Box>
            ))}
        </Paper>
    );
}

function MatchingOptionButtons({
    value,
    onChange,
    disabled = false,
}: {
    value: Partial<MatchingOptions>;
    onChange: (options: MatchingOptions) => void;
    disabled?: boolean;
}) {
    const options = {
        matchCase: value.matchCase ?? true,
        wholeWord: value.wholeWord ?? false,
        isRegex: value.isRegex ?? false,
    };
    return (
        <Box sx={{ display: "flex", gap: 0.5 }}>
            {matchingOptions.map(({ key, label, symbol }) => (
                <Tooltip
                    key={key}
                    title={`${label} (${options[key] ? "on" : "off"})`}
                >
                    <IconButton
                        size="small"
                        disabled={disabled}
                        aria-label={label}
                        aria-pressed={options[key]}
                        color={options[key] ? "primary" : "default"}
                        onClick={() =>
                            onChange({ ...options, [key]: !options[key] })
                        }
                        sx={{
                            borderRadius: 1,
                            bgcolor: options[key]
                                ? "action.selected"
                                : "transparent",
                        }}
                    >
                        <Typography
                            component="span"
                            sx={{
                                fontFamily: "monospace",
                                fontSize: 14,
                                fontWeight: 600,
                                textDecoration:
                                    key === "wholeWord" ? "underline" : "none",
                            }}
                        >
                            {symbol}
                        </Typography>
                    </IconButton>
                </Tooltip>
            ))}
        </Box>
    );
}
