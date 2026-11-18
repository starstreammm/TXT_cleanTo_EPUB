import {
    Button,
    Dialog,
    DialogContent,
    DialogTitle,
    DialogActions,
    DialogContentText,
    CircularProgress,
    Typography,
} from "@mui/material";
import { diffArrays } from "diff";
import { api } from "~/hooks/api";
import { pushError } from "~/components/error_popout";



export function SavingDialog() {
    return (
        <Dialog open fullWidth>
            <DialogContent sx={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                gap: 8,
                py: 13,
            }}>
                <CircularProgress enableTrackSlot size={88} />
                <Typography>
                    Saving...
                </Typography>
            </DialogContent>
        </Dialog>
    )
}


export function UnSaveDialog({ onClose }: { onClose: (saved: boolean) => void }) {
    return (
        <Dialog open onClose={() => onClose(false)}>
            <DialogTitle>Unsaved Changes</DialogTitle>
            <DialogContent>
                <DialogContentText>
                    You have unsaved changes. Do you want to save them before closing?
                </DialogContentText>
            </DialogContent>
            <DialogActions>
                <Button onClick={() => onClose(false)} color="error" variant="outlined">
                    Discard
                </Button>
                <Button onClick={() => onClose(true)} variant="contained">
                    Save
                </Button>
            </DialogActions>
        </Dialog>
    );
}



export async function saveUpdate(
    orgContent: string,
    modContent: string,
    uid: string,
) {
    const orgLines = splitLines(orgContent);
    const modLines = splitLines(modContent);

    const changes = diffArrays(orgLines, modLines);
    const result: Record<number, string> = {};

    let orgLine = 0;
    for (let i = 0; i < changes.length; i++) {
        const part = changes[i];

        if (part.removed) {
            for (let j = 0; j < part.count; j++) {
                result[orgLine] = "";
                orgLine++;
            }

            i++;
            let insert = "";
            while (i < changes.length) {
                const next = changes[i];
                if (next.added) {
                    const text = next.value.join("");
                    insert += text;
                    i++;
                }
                else {
                    i--;
                    break;
                }
            }
            if (insert)
                result[orgLine - 1] = insert;
        }

        else if (part.added) {
            let insert = part.value.join("");
            i++;
            while (i < changes.length) {
                const next = changes[i];
                if (next.added) {
                    insert += next.value.join("");
                    i++;
                }
                else {
                    i--;
                    break;
                }
            }
            if (orgLine === 0)
                result[-1] = insert;
            else
                result[orgLine - 1] = orgLines[orgLine - 1] + insert;
        }

        else
            orgLine += part.count;
    }

    console.log("saveUpdate", result);
    try {
        await api.post("/api/file/update/content", {
            json: result,
            searchParams: { uid },
        });
    }
    catch (error) {
        pushError(error, "Update file");
        throw error;
    }
}

function splitLines(content: string): string[] {
    return content.match(/[^\n]*\n|[^\n]+$/g) ?? [];
}
