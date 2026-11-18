import { useId, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    Box,
    Button,
    IconButton,
    TextField,
    type TextFieldProps,
    Tooltip,
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import { pushError } from "~/components/error_popout";
import { api } from "~/hooks/api";
import type { Pattern } from "~/hooks/models";

export const patternUrl = "/api/pattern";
export const whitespaceKeys = [
    ["{s}", "One whitespace character"],
    ["{S}", "One non-whitespace character"],
    ["{n}", "One or more digits"],
    ["{e}", "One or more English letters"],
];

export interface HeadingRulePair {
    pattern: string;
    replacement: string;
}

export type HeadingType = "volume" | "chapter" | "section";

export function usePatternHistory(category: HeadingType) {
    const client = useQueryClient();
    const queryKey = ["pattern-keys", category];
    const history = useQuery({
        queryKey,
        meta: { errorContext: "Load rule history" },
        queryFn: ({ signal }) =>
            api
                .get(`${patternUrl}/history`, {
                    searchParams: { category },
                    signal,
                })
                .json<{
                    file: string[];
                    rules: HeadingRulePair[];
                }>(),
    });
    const deleteEntry = useMutation({
        mutationFn: async (pair: HeadingRulePair) => {
            await api.delete(`${patternUrl}/history`, {
                searchParams: { category },
                json: pair,
            });
        },
        onSuccess: () => client.invalidateQueries({ queryKey }),
        onError: (error) => pushError(error, "Delete rule history entry"),
    });
    return { history, deleteEntry };
}

export function AddPatternRuleButton({
    rules,
    disabled,
    onChange,
}: {
    rules: Pattern[];
    disabled: boolean;
    onChange: (rules: Pattern[]) => void;
}) {
    return (
        <Button
            disabled={disabled}
            startIcon={<AddRoundedIcon />}
            onClick={() =>
                onChange([...rules, { enable: true, alias: "", pattern: "" }])
            }
        >
            Add rule
        </Button>
    );
}

export function PatternRules({
    rules,
    busy,
    onChange,
    renderFields,
    actions,
}: {
    rules: Pattern[];
    busy: boolean;
    onChange: (rules: Pattern[]) => void;
    renderFields: (
        rule: Pattern,
        edit: (changes: Partial<Pattern>) => void,
        index: number,
    ) => ReactNode;
    actions?: ReactNode;
}) {
    return (
        <Box
            component="fieldset"
            disabled={busy}
            sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}
        >
            {rules.map((rule, index) => {
                const edit = (changes: Partial<Pattern>) =>
                    onChange(
                        rules.map((item, i) =>
                            i === index ? { ...item, ...changes } : item,
                        ),
                    );
                return (
                    <Box
                        key={index}
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            flexWrap: "wrap",
                            gap: 1,
                            py: 0.8,
                        }}
                    >
                        {renderFields(rule, edit, index)}
                        <IconButton
                            aria-label="Delete rule"
                            color="error"
                            onClick={() =>
                                onChange(rules.filter((_, i) => i !== index))
                            }
                            sx={{ mr: -2 }}
                        >
                            <DeleteOutlineRoundedIcon />
                        </IconButton>
                    </Box>
                );
            })}
            {actions && (
                <Box sx={{ display: "flex", gap: 1, mt: 1 }}>{actions}</Box>
            )}
        </Box>
    );
}

export function PatternField({
    label,
    value,
    keys,
    note,
    disabled,
    sx,
    onChange,
}: {
    label: string;
    value: string;
    keys: string[][];
    note?: string;
    disabled: boolean;
    sx?: TextFieldProps["sx"];
    onChange: (value: string) => void;
}) {
    const helpId = useId();
    const [focused, setFocused] = useState(false);
    const [hovered, setHovered] = useState(false);
    const isMatch = label === "Match";
    const showHelp = !disabled && (focused || (!isMatch && hovered));
    return (
        <Tooltip
            id={helpId}
            title={<PatternHelp keys={keys} note={note} />}
            describeChild
            placement="bottom-start"
            slotProps={{
                popper: { modifiers: [{ name: "flip", enabled: false }] },
            }}
            open={showHelp}
            disableFocusListener
            disableHoverListener
            disableTouchListener
            disableInteractive
        >
            <TextField
                size="small"
                fullWidth
                label={label}
                value={value}
                disabled={disabled}
                sx={sx}
                slotProps={{
                    htmlInput: {
                        "aria-describedby": showHelp ? helpId : undefined,
                    },
                }}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onMouseEnter={isMatch ? undefined : () => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
                onChange={(event) => onChange(event.target.value)}
            />
        </Tooltip>
    );
}

function PatternHelp({ keys, note }: { keys: string[][]; note?: string }) {
    return (
        <Box sx={{ py: 0.5 }}>
            {keys.map(([key, description]) => (
                <Box key={key}>
                    <strong>{key}</strong> {description}
                </Box>
            ))}
            {note && <Box sx={{ mt: 0.5 }}>{note}</Box>}
        </Box>
    );
}
