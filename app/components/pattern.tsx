import {
    Dialog,
    DialogTitle,
    DialogContent,
    ListItemButton,
    ListItemText,
    ListItemIcon,
    TableContainer,
    Table,
    TableHead,
    TableRow,
    TableCell,
    TableBody,
    Button,
    Collapse,
    Checkbox,
    IconButton,
    Typography,
    TextField,
    Tooltip,
} from "@mui/material";
import ExpandLessRoundedIcon from '@mui/icons-material/ExpandLessRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteForeverRoundedIcon from '@mui/icons-material/DeleteForeverRounded';
import AddCircleOutlineRoundedIcon from '@mui/icons-material/AddCircleOutlineRounded';
import DoneRoundedIcon from '@mui/icons-material/DoneRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import UndoRoundedIcon from '@mui/icons-material/UndoRounded';

import { useEffect, useState, Fragment } from "react";

import type { Pattern, PatternType } from "~/hooks/models";
import { api } from "~/hooks/api";
import { pushError, pushMsg } from "~/components/error_popout";


const Type = ["file", "chapter", "adv", "volume"] as PatternType[]
const DefaultPattern: Pattern = {
    enable: true,
    alias: "",
    pattern: "",
}
const HelpText: Record<PatternType, [string, string][]> = {
    file: [
        ["title", "Novel title"],
        ["creator", "Author"],
    ],

    chapter: [
        ["title", "Chapter title"],
        ["chapter", "Chapter number, supports Chinese numerals and Arabic numbers, displayed as Chapter x"],
        ["extchapter", "Extra chapter number, supports Chinese numerals and Arabic numbers, displayed as Extra x"],
    ],

    volume: [
        ["title", "Volume title"],
        ["volume", "Volume number, supports Chinese numerals and Arabic numbers"],
    ],

    adv: [],
};

export default function PatternDialog({ exclude = [], onClose }: { exclude?: PatternType[]; onClose: () => void }) {
    const [extend, setExtend] = useState<PatternType | null>(null);


    return (
        <Dialog open fullWidth onClose={onClose} maxWidth={false}>
            <DialogTitle sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                p: 3,
            }}>
                <Typography variant="h5" sx={{ color: "primary.main" }}>
                    Pattern Settings
                </Typography>
                <IconButton onClick={onClose} sx={{ borderRadius: "13%" }}>
                    <CloseRoundedIcon />
                </IconButton>
            </DialogTitle>
            <DialogContent>
                {Type
                    .filter((type) => !exclude.includes(type))
                    .map((type) =>
                        <PatternRow
                            key={type}
                            type={type}
                            extend={extend === type}
                            setExtend={(extend) => setExtend(extend ? type : null)}
                        />
                    )
                }
            </DialogContent>
        </Dialog>
    );
}


function PatternRow({ type, extend, setExtend }: {
    type: PatternType,
    extend: boolean,
    setExtend: (extend: boolean) => void,
}) {
    const [patterns, setPatterns] = useState<Pattern[]>([]);
    const [edit, setEdit] = useState<number | null>(null); // -1 for new pattern


    useEffect(() => {
        getPattern(type)
            .then((res) => setPatterns(res));
    }, []);


    return (
        <>
            <ListItemButton onClick={() => setExtend(!extend)}>
                <ListItemText>
                    {type.slice(0, 1).toUpperCase() + type.slice(1)} ({patterns.length})
                </ListItemText>
                <ListItemIcon sx={{ alignItems: "center", gap: 3 }}>
                    <Button
                        variant="contained"
                        startIcon={<AddCircleOutlineRoundedIcon />}
                        onClick={(e) => {
                            e.stopPropagation();
                            setExtend(true);
                            setEdit(-1);
                        }}
                    >
                        New Rule
                    </Button>
                    <Button
                        variant="outlined"
                        startIcon={<UndoRoundedIcon />}
                        onClick={(e) => {
                            e.stopPropagation();
                            resetPattern(type)
                                .then((res) => setPatterns(res));
                        }}
                    >
                        Reset
                    </Button>
                    {extend ? <ExpandLessRoundedIcon /> : <ExpandMoreRoundedIcon />}
                </ListItemIcon>
            </ListItemButton>
            <Collapse in={extend} timeout="auto" unmountOnExit>
                <TableContainer>
                    <Table size="small" stickyHeader>
                        <TableHead>
                            <TableRow>
                                <TableCell>Enable</TableCell>
                                <TableCell sx={{ width: "33%" }}>Alias</TableCell>
                                <TableCell sx={{ width: "67%" }}>Pattern</TableCell>
                                <TableCell>Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {edit === -1 &&
                                <EditableRow type={type} onClose={(value) => {
                                    if (value) {
                                        const newPatterns = [value, ...patterns];
                                        setPatterns(newPatterns);
                                        updatePattern(type, newPatterns);
                                    }
                                    setEdit(null);
                                }} />
                            }
                            {patterns.map((pattern, index) => (
                                edit === index
                                    ? <EditableRow type={type} defaultValue={pattern} onClose={(value) => {
                                        if (value) {
                                            const newPatterns = [...patterns];
                                            newPatterns[index] = value;
                                            setPatterns(newPatterns);
                                            updatePattern(type, newPatterns);
                                        }
                                        setEdit(null);
                                    }} />
                                    : <TableRow key={index}>
                                        <TableCell>
                                            <Checkbox
                                                checked={pattern.enable}
                                                onChange={(e) => {
                                                    const newPatterns = [...patterns];
                                                    newPatterns[index].enable = e.target.checked;
                                                    setPatterns(newPatterns);
                                                    updatePattern(type, newPatterns);
                                                }}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            {pattern.alias}
                                        </TableCell>
                                        <TableCell>
                                            {pattern.pattern}
                                        </TableCell>
                                        <TableCell sx={{ whiteSpace: "nowrap" }}>
                                            <IconButton onClick={() => {
                                                if (edit)
                                                    pushMsg("Please finish editing the current pattern first", "warning");
                                                else
                                                    setEdit(index);
                                            }}>
                                                <EditRoundedIcon color="primary" />
                                            </IconButton>
                                            <IconButton sx={{ ml: 1 }} onClick={() => {
                                                const newPatterns = [...patterns];
                                                newPatterns.splice(index, 1);
                                                setPatterns(newPatterns);
                                                updatePattern(type, newPatterns);
                                            }}>
                                                <DeleteForeverRoundedIcon color="error" />
                                            </IconButton>
                                        </TableCell>
                                    </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Collapse>
        </>
    );
}



function EditableRow({ type, defaultValue, onClose }: {
    type: PatternType,
    defaultValue?: Pattern,
    onClose: (value?: Pattern) => void,
}) {
    const [pattern, setPattern] = useState<Pattern>(defaultValue ?? DefaultPattern);

    return (
        <TableRow>
            <TableCell>
                <Checkbox
                    checked={pattern.enable}
                    onChange={(e) => setPattern((prev) => ({ ...prev, enable: e.target.checked }))}
                />
            </TableCell>
            <TableCell sx={{ width: "33%" }}>
                <TextField
                    size="small"
                    fullWidth
                    value={pattern.alias}
                    onChange={(e) => setPattern((prev) => ({ ...prev, alias: e.target.value }))}
                />
            </TableCell>
            <TableCell sx={{ width: "67%" }}>
                <Tooltip
                    arrow
                    placement="bottom-start"
                    title={
                        <Typography variant="body1" sx={{ color: "text.secondary" }}>
                            {[
                                ...HelpText[type],
                                ["n", "Any length of digits"],
                                ["a", "Any length of English letters"],
                                ["s", "Any length of any characters, including whitespace"],
                            ].map(([key, desc]) =>
                                <Fragment key={key}>
                                    <b>{`{${key}}`}</b> - {desc}.<br />
                                </Fragment>
                            )}
                        </Typography>
                    }
                >
                    <TextField
                        size="small"
                        fullWidth
                        value={pattern.pattern}
                        onChange={(e) => setPattern((prev) => ({ ...prev, pattern: e.target.value }))}
                    />
                </Tooltip>
            </TableCell>
            <TableCell sx={{ whiteSpace: "nowrap", gap: 1 }}>
                <IconButton onClick={() => {
                    if (!pattern.alias || !pattern.pattern)
                        pushMsg("Alias and Pattern cannot be empty", "warning");
                    else
                        onClose(pattern);
                }}>
                    <DoneRoundedIcon color="success" />
                </IconButton>
                <IconButton sx={{ ml: 1 }} onClick={() => onClose()}>
                    <CloseRoundedIcon color="error" />
                </IconButton>
            </TableCell>
        </TableRow>
    );
}



async function getPattern(type: PatternType) {
    try {
        const res = await api.get(`/api/pattern/${type}`).json<Pattern[]>();
        return res;
    }
    catch (error) {
        pushError(error, "Get pattern");
        throw error;
    }
}


async function updatePattern(type: PatternType, patterns: Pattern[]) {
    try {
        await api.post(`/api/pattern/${type}/update`, { json: patterns })
    }
    catch (error) {
        pushError(error, "Update pattern");
        throw error;
    }
}

async function resetPattern(type: PatternType) {
    try {
        const res = await api.post(`/api/pattern/${type}/reset`).json<Pattern[]>();
        return res;
    }
    catch (error) {
        pushError(error, "Reset pattern");
        throw error;
    }
}