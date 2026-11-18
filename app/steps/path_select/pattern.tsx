import { useId, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
    Button,
    Checkbox,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    TextField,
    Tooltip,
    Typography,
} from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import ReplayRoundedIcon from "@mui/icons-material/ReplayRounded";
import {
    AddPatternRuleButton,
    PatternField,
    PatternRules,
    patternUrl,
    whitespaceKeys,
} from "~/components/pattern_fields";
import { pushError } from "~/components/error_popout";
import { api } from "~/hooks/api";
import type { Pattern } from "~/hooks/models";

const filenameKeys = [
    ["{title}", "Book title"],
    ["{creator}", "Author"],
    ...whitespaceKeys,
];
const settingsKey = ["filename-patterns"];

export default function FilenamePatternDialog({
    onClose,
    onPatternsChanged,
}: {
    onClose: () => void;
    onPatternsChanged: () => Promise<void>;
}) {
    const client = useQueryClient();
    const dialogTitle = useId();
    const settings = useQuery({
        queryKey: settingsKey,
        meta: { errorContext: "Load filename patterns" },
        queryFn: ({ signal }) =>
            api.get(`${patternUrl}/filename`, { signal }).json<Pattern[]>(),
        retry: false,
        refetchOnMount: "always",
        refetchOnWindowFocus: false,
    });
    const [draft, setDraft] = useState<Pattern[] | null>(null);
    const [busy, setBusy] = useState(false);
    const current = draft ?? settings.data;

    async function save() {
        if (!draft) return;
        setBusy(true);
        try {
            await api.put(`${patternUrl}/filename`, { json: draft });
            client.setQueryData(settingsKey, draft);
            await onPatternsChanged();
            onClose();
        } catch (error) {
            pushError(error, "Save patterns");
        } finally {
            setBusy(false);
        }
    }

    async function reset() {
        setBusy(true);
        try {
            const patterns = await api
                .post(`${patternUrl}/filename/reset`)
                .json<Pattern[]>();
            client.setQueryData(settingsKey, patterns);
            setDraft(null);
            await onPatternsChanged();
        } catch (error) {
            pushError(error, "Restore filename defaults");
        } finally {
            setBusy(false);
        }
    }

    return (
        <Dialog
            open
            fullWidth
            maxWidth="md"
            aria-labelledby={dialogTitle}
            onClose={busy ? undefined : onClose}
        >
            <DialogTitle id={dialogTitle}>
                Filename Patterns
                <Tooltip
                    title="Rules match the filename without its extension and apply to every file."
                    arrow
                    placement="bottom"
                    sx={{ ml: 1 }}
                >
                    <IconButton>
                        <InfoOutlinedIcon />
                    </IconButton>
                </Tooltip>
                <Tooltip
                    title="Restore Defaults"
                    arrow
                    placement="bottom"
                    sx={{ ml: 1 }}
                >
                    <IconButton onClick={reset} disabled={busy}>
                        <ReplayRoundedIcon />
                    </IconButton>
                </Tooltip>
            </DialogTitle>
            <DialogContent>
                {current ? (
                    <PatternRules
                        rules={current}
                        busy={busy}
                        onChange={setDraft}
                        actions={
                            <AddPatternRuleButton
                                rules={current}
                                disabled={busy}
                                onChange={setDraft}
                            />
                        }
                        renderFields={(rule, edit) => (
                            <>
                                <Checkbox
                                    checked={rule.enable}
                                    onChange={(_, enable) => edit({ enable })}
                                    slotProps={{
                                        input: {
                                            "aria-label": "Enable rule",
                                        },
                                    }}
                                />
                                <TextField
                                    label="Alias"
                                    size="small"
                                    value={rule.alias}
                                    sx={{ flex: "1 1 7rem" }}
                                    onChange={(event) =>
                                        edit({ alias: event.target.value })
                                    }
                                />
                                <PatternField
                                    label="Match"
                                    value={rule.pattern}
                                    sx={{ flex: "2 1 10rem", minWidth: 0 }}
                                    keys={filenameKeys}
                                    disabled={busy}
                                    onChange={(pattern) => edit({ pattern })}
                                />
                            </>
                        )}
                    />
                ) : settings.isError ? (
                    <Button onClick={() => void settings.refetch()}>
                        Retry loading filename patterns
                    </Button>
                ) : (
                    <Typography>Loading patterns…</Typography>
                )}
            </DialogContent>
            <DialogActions>
                <Button
                    disabled={busy}
                    onClick={onClose}
                    color="error"
                    variant="outlined"
                >
                    {draft ? "Cancel" : "Close"}
                </Button>
                <Button
                    variant="contained"
                    loading={busy}
                    disabled={!draft}
                    onClick={save}
                >
                    Save
                </Button>
            </DialogActions>
        </Dialog>
    );
}
