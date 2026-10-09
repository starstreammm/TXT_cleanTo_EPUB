import { Box, Button, Paper } from "@mui/material";
import NavigateNextRoundedIcon from '@mui/icons-material/NavigateNextRounded';
import EditNoteRoundedIcon from '@mui/icons-material/EditNoteRounded';

import { useState } from "react";

import { api } from "~/hooks/api";
import { useLocalStorage } from "~/hooks/storage";
import { pushError } from "~/components/error_popout";
import PathSelector from "~/components/pathselector";
import PatternDialog from "~/components/pattern";


export default function PathSelect({ onNext }: { onNext: () => void }) {
    const [workDir, setWorkDir] = useLocalStorage<string>("work_dir", "");
    const [loading, setLoading] = useState<boolean>(false);
    const [pattern, setPattern] = useState<boolean>(false);

    const handleNext = (path?: string) => {
        setLoading(true);
        api.post("/api/file/work_dir", { searchParams: { path: path || workDir } })
            .then(() => onNext())
            .catch((err) => pushError(err, "Set work directory"))
            .finally(() => setLoading(false));
    };


    return (
        <Box sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            width: "100%",
            height: "100%",
        }}>
            <Paper elevation={13} sx={{
                width: "88%",
                height: "88%",
                p: 8,
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
            }}>
                {pattern &&
                    <PatternDialog
                        exclude={["chapter", "adv", "volume"]}
                        onClose={() => setPattern(false)}
                    />
                }
                <Button
                    variant="outlined"
                    startIcon={<EditNoteRoundedIcon />}
                    onClick={() => setPattern(true)}
                    sx={{ mb: 8 }}
                >
                    Edit File Name Matching Pattern
                </Button>
                <PathSelector
                    label="Work Directory"
                    value={workDir}
                    onClose={setWorkDir}
                    onEnter={(path) => {
                        setWorkDir(path);
                        handleNext(path);
                    }}
                />
                <Button
                    variant="contained"
                    loading={loading}
                    onClick={() => handleNext()}
                    endIcon={<NavigateNextRoundedIcon />}
                    sx={{ mt: "auto" }}
                >
                    Next
                </Button>
            </Paper>
        </Box>
    )
}