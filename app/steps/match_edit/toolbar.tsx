import {
    TextField,
    Box,
    Divider,
    IconButton,
    type IconButtonProps,
    Tooltip,
    Button,
    Badge,
} from "@mui/material";
import MenuOpenRoundedIcon from '@mui/icons-material/MenuOpenRounded';
import WrapTextRoundedIcon from '@mui/icons-material/WrapTextRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import VerticalSplitRoundedIcon from '@mui/icons-material/VerticalSplitRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import RemoveRoundedIcon from '@mui/icons-material/RemoveRounded';
import SyncRoundedIcon from '@mui/icons-material/SyncRounded';
import EditNoteRoundedIcon from '@mui/icons-material/EditNoteRounded';
import UndoRoundedIcon from '@mui/icons-material/UndoRounded';

import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";

import PatternDialog from "~/components/pattern";


function ToolIconButton({ props, icon, onClick, desc }: {
    props?: IconButtonProps;
    icon: React.ReactNode;
    onClick: () => void;
    desc?: string;
}) {
    const Button = (
        <IconButton
            size="small"
            onClick={onClick}
            sx={{ borderRadius: "3%" }}
            {...props}
        >
            {icon}
        </IconButton>
    );

    if (desc)
        return (
            <Tooltip title={desc} placement="bottom" arrow>
                {Button}
            </Tooltip>
        );

    else
        return Button;
}

const ToolDivider = (<Divider orientation="vertical" flexItem />);


export function EditorToolBar({
    showFileList,
    setShowFileList,
    fontSize,
    setFontSize,
    wordWrap,
    setWordWrap,
    diff,
    setDiff,
    unsave,
    onSave,
    onRefresh,
    onReset,
    setMetaData,
}: {
    showFileList: boolean;
    setShowFileList: Dispatch<SetStateAction<boolean>>;
    fontSize: number;
    setFontSize: Dispatch<SetStateAction<number>>;
    wordWrap: boolean;
    setWordWrap: Dispatch<SetStateAction<boolean>>;
    diff: boolean;
    setDiff?: Dispatch<SetStateAction<boolean>>;
    unsave: boolean;
    onSave: () => void;
    onRefresh: () => void;
    onReset: () => void;
    setMetaData: () => void;
}) {
    const [openPattern, setOpenPattern] = useState(false);

    return (
        <Box sx={{
            display: 'flex',
            alignItems: 'center',
            px: 1,
            gap: 1,
            width: '100%',
        }}>
            <ToolIconButton
                icon={<MenuOpenRoundedIcon />}
                onClick={() => setShowFileList(!showFileList)}
                props={{
                    sx: {
                        borderRadius: "3%",
                        transform: showFileList ? 'none' : 'rotate(180deg)',
                        transition: 'transform 0.8s ease',
                    }
                }}
            />
            <ToolIconButton
                icon={<EditNoteRoundedIcon />}
                onClick={setMetaData}
                desc="Edit Metadata"
                props={{ sx: { borderRadius: "3%", mr: "auto" } }}
            />


            <ToolIconButton
                icon={<SyncRoundedIcon />}
                onClick={onRefresh}
                desc="Refresh"
            />
            {ToolDivider}


            {openPattern &&
                <PatternDialog
                    exclude={["file"]}
                    onClose={() => setOpenPattern(false)}
                />
            }
            <Button onClick={() => setOpenPattern(true)} size="small" variant="outlined">
                Edit Pattern
            </Button>
            {ToolDivider}


            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <ToolIconButton
                    icon={<RemoveRoundedIcon />}
                    onClick={() => setFontSize(prev => Math.max(8, prev - 1))}
                    desc="Decrease Font Size"
                />
                <TextField
                    value={fontSize}
                    onChange={(e) => {
                        const value = Number(e.target.value);
                        if (!Number.isNaN(value)) {
                            setFontSize(value);
                        }
                    }}
                    size="small"
                    sx={{
                        width: 60,
                        "& input": {
                            textAlign: "center",
                            padding: "6px 4px",
                        },
                    }}
                />
                <ToolIconButton
                    icon={<AddRoundedIcon />}
                    onClick={() => setFontSize(prev => Math.min(32, prev + 1))}
                    desc="Increase Font Size"
                />
            </Box>
            {ToolDivider}



            <ToolIconButton
                icon={<VerticalSplitRoundedIcon color={diff ? "primary" : "disabled"} />}
                onClick={() => setDiff?.(!diff)}
                desc="Diff View"
                props={{ disabled: !setDiff }}
            />
            <ToolIconButton
                icon={<WrapTextRoundedIcon color={wordWrap ? "primary" : "disabled"} />}
                onClick={() => setWordWrap(!wordWrap)}
                desc="Word Wrap"
            />
            {ToolDivider}


            <ToolIconButton
                icon={<UndoRoundedIcon />}
                onClick={onReset}
                desc="Discard Changes"
                props={{ disabled: !unsave }}
            />
            <ToolIconButton
                icon={<Badge invisible={!unsave} color="error" variant="dot">
                    <SaveRoundedIcon color={unsave ? "info" : undefined} />
                </Badge>}
                onClick={onSave}
                desc="Save Changes"
                props={{ disabled: !unsave }}
            />
        </Box>
    );
}