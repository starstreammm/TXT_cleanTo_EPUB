import { useId, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControlLabel,
    IconButton,
    List,
    ListItem,
    Switch,
    Tab,
    Tabs,
    Tooltip,
    Typography,
} from "@mui/material";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import {
    AddPatternRuleButton,
    PatternField,
    PatternRules,
    patternUrl,
    usePatternHistory,
    whitespaceKeys,
    type HeadingRulePair,
    type HeadingType,
} from "~/components/pattern_fields";
import { api } from "~/hooks/api";
import type { Pattern } from "~/hooks/models";
import { pushError } from "~/components/error_popout";

interface Settings {
    patterns: Pattern[];
    restart: boolean;
}

type Configuration = Partial<Record<HeadingType, Settings>>;

const emptySettings: Settings = { patterns: [], restart: true };
const headings = ["volume", "chapter", "section"] as const;
const labels = {
    volume: "Volumes",
    chapter: "Chapters",
    section: "Sections",
};
const parents = { chapter: "volume", section: "chapter" };
const ruleSpacing = { xs: 1.5, sm: 3 };
const matchKeys = [
    ["{index}", "Arabic or Chinese number"],
    ["{title}", "Heading title"],
    ...whitespaceKeys,
];
const replacementKeys = [
    ["{title}", "Captured title"],
    ["{index}", "Captured index in digits"],
    ["{index-zh}", "Captured index in Chinese numerals"],
    ["{reorder}", "Consecutive number starting at 1"],
    ["{reorder-zh}", "Consecutive number in Chinese numerals, starting at 一"],
];

function ruleCount(settings: Settings) {
    const total = settings.patterns.length;
    const enabled = settings.patterns.filter((rule) => rule.enable).length;
    return enabled === total
        ? `${total} ${total === 1 ? "rule" : "rules"}`
        : `${enabled}/${total} active`;
}

export default function HeadingPatternDialog({
    uid,
    onClose,
}: {
    uid: string;
    onClose: () => void;
}) {
    const client = useQueryClient();
    const dialogTitle = useId();
    const settingsKey = ["pattern-settings", uid];
    const settings = useQuery({
        queryKey: settingsKey,
        meta: { errorContext: "Load heading patterns" },
        queryFn: ({ signal }) =>
            api
                .get(`${patternUrl}/settings`, {
                    searchParams: { uid },
                    signal,
                })
                .json<Configuration>(),
        retry: false,
        refetchOnMount: "always",
        refetchOnWindowFocus: false,
    });
    const [draft, setDraft] = useState<Configuration | null>(null);
    const [active, setActive] = useState<HeadingType>("volume");
    const [busy, setBusy] = useState(false);
    const current = draft ?? settings.data;
    const config = current?.[active] ?? emptySettings;

    function change(next: Settings) {
        setDraft((previous) => ({
            ...(previous ?? settings.data),
            [active]: next,
        }));
    }

    async function save() {
        if (!draft) return;
        setBusy(true);
        try {
            await api.put(`${patternUrl}/settings`, {
                searchParams: { uid },
                json: draft,
            });
            client.setQueryData(settingsKey, draft);
            onClose();
        } catch (error) {
            pushError(error, "Save patterns");
        } finally {
            setBusy(false);
        }
    }

    return (
        <Dialog
            open
            fullWidth
            aria-labelledby={dialogTitle}
            maxWidth="md"
            onClose={busy ? undefined : onClose}
        >
            <DialogTitle
                component="div"
                id={`${dialogTitle}-header`}
                sx={{
                    display: "flex",
                    flexDirection: { xs: "column", md: "row" },
                    alignItems: { xs: "stretch", md: "center" },
                    gap: 3,
                    px: ruleSpacing,
                }}
            >
                <Typography
                    component="h2"
                    variant="h6"
                    id={dialogTitle}
                    sx={{ flexShrink: 0 }}
                >
                    Pattern Settings
                </Typography>
                {current && (
                    <HeadingCards
                        settings={current}
                        active={active}
                        onSelect={setActive}
                        busy={busy}
                        id={dialogTitle}
                    />
                )}
            </DialogTitle>
            <DialogContent sx={{ px: ruleSpacing }}>
                {current ? (
                    <Box
                        role="tabpanel"
                        id={`${dialogTitle}-panel`}
                        aria-labelledby={`${dialogTitle}-tab-${active}`}
                    >
                        <HeadingRules
                            key={active}
                            type={active}
                            config={config}
                            busy={busy}
                            onChange={change}
                        />
                    </Box>
                ) : settings.isError ? (
                    <Button onClick={() => void settings.refetch()}>
                        Retry loading patterns
                    </Button>
                ) : (
                    <Typography>Loading patterns…</Typography>
                )}
            </DialogContent>
            <DialogActions sx={{ px: ruleSpacing, pb: 2 }}>
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

function HeadingRules({
    type,
    config,
    busy,
    onChange,
}: {
    type: HeadingType;
    config: Settings;
    busy: boolean;
    onChange: (settings: Settings) => void;
}) {
    const rules = config.patterns;
    const { history, deleteEntry } = usePatternHistory(type);
    const pairs = history.data?.rules ?? [];
    const [target, setTarget] = useState(0);
    const historyColumns = "minmax(0, 1fr) minmax(0, 1fr) 6rem 2rem";

    function updateRules(next: Pattern[]) {
        if (next.length > rules.length) {
            setTarget(next.length - 1);
        } else if (next.length < rules.length) {
            const index = next.indexOf(rules[target]);
            setTarget(
                index >= 0
                    ? index
                    : Math.max(0, Math.min(target, next.length - 1)),
            );
        }
        onChange({ ...config, patterns: next });
    }

    function applyHistory(values: Partial<HeadingRulePair>) {
        updateRules(
            rules.length
                ? rules.map((rule, index) =>
                      index === target ? { ...rule, ...values } : rule,
                  )
                : [{ enable: true, alias: "", pattern: "", ...values }],
        );
    }

    return (
        <>
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 1,
                    mb: 1,
                }}
            >
                <AddPatternRuleButton
                    rules={rules}
                    disabled={busy}
                    onChange={updateRules}
                />
                {type !== "volume" && (
                    <FormControlLabel
                        sx={{ m: 0 }}
                        control={
                            <Switch
                                checked={config.restart}
                                disabled={busy}
                                onChange={(_, restart) =>
                                    onChange({ ...config, restart })
                                }
                            />
                        }
                        label={`Restart numbering in each ${parents[type]}`}
                    />
                )}
            </Box>
            <PatternRules
                rules={rules}
                busy={busy}
                onChange={updateRules}
                renderFields={(rule, edit, index) => (
                    <Box
                        onClick={() => setTarget(index)}
                        onFocus={() => setTarget(index)}
                        sx={{
                            display: "grid",
                            gridTemplateColumns: {
                                xs: "auto minmax(0, 1fr)",
                                sm: "auto minmax(0, 1fr) minmax(0, 1fr)",
                            },
                            alignItems: "center",
                            columnGap: ruleSpacing,
                            flex: "1 1 0",
                            minWidth: 0,
                        }}
                    >
                        <Typography
                            component="span"
                            variant="body2"
                            color="primary"
                            aria-current={target === index ? "true" : undefined}
                            sx={{
                                fontWeight: 600,
                                gridRow: { xs: "span 2", sm: "auto" },
                            }}
                        >
                            RULE {index + 1}
                            {!rule.enable && " (disabled)"}
                        </Typography>
                        <PatternField
                            label="Match"
                            value={rule.pattern}
                            keys={matchKeys}
                            disabled={busy}
                            onChange={(pattern) => edit({ pattern })}
                        />
                        <PatternField
                            label="Replacement"
                            value={rule.replacement ?? ""}
                            keys={replacementKeys}
                            disabled={busy}
                            note="Title and index require a matching capture. Heading markers are added automatically."
                            onChange={(replacement) => edit({ replacement })}
                        />
                    </Box>
                )}
            />
            <Box sx={{ mt: 3 }}>
                <Typography component="h3" variant="subtitle1">
                    History
                </Typography>
                {history.isPending && (
                    <Typography variant="body2">
                        Loading rule history…
                    </Typography>
                )}
                {history.isError && (
                    <Button onClick={() => void history.refetch()}>
                        Retry loading rule history
                    </Button>
                )}
                {history.isSuccess && pairs.length === 0 && (
                    <Typography variant="body2" color="text.secondary">
                        No saved rule history yet.
                    </Typography>
                )}
                {pairs.length > 0 && (
                    <Box
                        sx={{
                            display: "grid",
                            gridTemplateColumns: historyColumns,
                            overflow: "hidden",
                        }}
                    >
                        <List
                            disablePadding
                            aria-label="Previously used rule pairs"
                            sx={{
                                gridColumn: "1 / -1",
                                maxHeight: "43vh",
                                overflowY: "auto",
                            }}
                        >
                            {pairs.map((pair) => (
                                <ListItem
                                    key={JSON.stringify(pair)}
                                    disablePadding
                                    sx={{
                                        display: "grid",
                                        gridTemplateColumns: historyColumns,
                                        py: 0.25,
                                    }}
                                >
                                    <HistoryValue
                                        label="match"
                                        value={pair.pattern}
                                        disabled={busy}
                                        onClick={() =>
                                            applyHistory({
                                                pattern: pair.pattern,
                                            })
                                        }
                                    />
                                    <HistoryValue
                                        label="replacement"
                                        value={pair.replacement}
                                        disabled={busy}
                                        onClick={() =>
                                            applyHistory({
                                                replacement: pair.replacement,
                                            })
                                        }
                                    />
                                    <Button
                                        size="small"
                                        disabled={busy}
                                        onClick={() => applyHistory(pair)}
                                    >
                                        Use pair
                                    </Button>
                                    <Tooltip
                                        title="Delete from history"
                                        placement="bottom"
                                    >
                                        <Box
                                            component="span"
                                            sx={{ justifySelf: "center" }}
                                        >
                                            <IconButton
                                                aria-label={`Delete from history: ${pair.pattern} → ${pair.replacement}`}
                                                size="small"
                                                color="error"
                                                disabled={
                                                    busy ||
                                                    deleteEntry.isPending
                                                }
                                                onClick={() =>
                                                    deleteEntry.mutate(pair)
                                                }
                                            >
                                                <DeleteOutlineRoundedIcon />
                                            </IconButton>
                                        </Box>
                                    </Tooltip>
                                </ListItem>
                            ))}
                        </List>
                    </Box>
                )}
            </Box>
        </>
    );
}

function HistoryValue({
    label,
    value,
    disabled,
    onClick,
}: {
    label: string;
    value: string;
    disabled: boolean;
    onClick: () => void;
}) {
    return (
        <Button
            size="small"
            color="inherit"
            disabled={disabled}
            aria-label={`Use ${label}: ${value}`}
            onClick={onClick}
            sx={{
                minWidth: 0,
                justifyContent: "flex-start",
                textAlign: "left",
                textTransform: "none",
                overflowWrap: "anywhere",
            }}
        >
            <code>{value}</code>
        </Button>
    );
}

function HeadingCards({
    settings,
    active,
    onSelect,
    busy,
    id,
}: {
    settings: Configuration;
    active: HeadingType;
    onSelect: (type: HeadingType) => void;
    busy: boolean;
    id: string;
}) {
    return (
        <Tabs
            value={active}
            onChange={(_, type: HeadingType) => onSelect(type)}
            selectionFollowsFocus
            aria-label="Heading rules"
            variant="scrollable"
            scrollButtons={false}
            sx={{ flex: 1, minWidth: 0 }}
            slotProps={{
                indicator: { sx: { display: "none" } },
                list: { sx: { gap: 1 } },
            }}
        >
            {headings.map((type) => {
                const category = settings[type] ?? emptySettings;
                let status = "\u00a0";
                if (type !== "volume") {
                    status = category.restart
                        ? `Restarts each ${parents[type]}`
                        : "Continuous numbering";
                }
                return (
                    <Tab
                        key={type}
                        id={`${id}-tab-${type}`}
                        aria-controls={`${id}-panel`}
                        value={type}
                        disabled={busy}
                        sx={{
                            flex: "1 0 auto",
                            alignItems: "flex-start",
                            textTransform: "none",
                            borderRadius: 2,
                            px: 1.5,
                            py: 1,
                            bgcolor: "background.default",
                            border: 1,
                            borderColor: "transparent",
                            "&.Mui-selected": {
                                bgcolor: "background.paper",
                                borderColor: "primary.main",
                                color: "text.primary",
                            },
                        }}
                        label={
                            <>
                                <Box
                                    component="span"
                                    sx={{
                                        display: "flex",
                                        alignItems: "baseline",
                                        gap: 1,
                                    }}
                                >
                                    <Typography
                                        component="span"
                                        variant="subtitle2"
                                    >
                                        {labels[type]}
                                    </Typography>
                                    <Typography
                                        component="span"
                                        variant="caption"
                                    >
                                        {ruleCount(category)}
                                    </Typography>
                                </Box>
                                <Typography
                                    component="span"
                                    variant="caption"
                                    color="text.secondary"
                                >
                                    {status}
                                </Typography>
                            </>
                        }
                    />
                );
            })}
        </Tabs>
    );
}
