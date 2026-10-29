import { List, ListItemButton, ListItemText } from "@mui/material";
import type { FileInfo } from "~/hooks/models";

export default function FileList({
    files,
    selectedUid,
    onOpen,
}: {
    files: FileInfo[];
    selectedUid: string | null;
    onOpen: (file: FileInfo) => void;
}) {
    return (
        <List sx={{ width: "100%", height: "100%" }}>
            {files.map((file) => (
                <ListItemButton
                    key={file.uid}
                    selected={selectedUid === file.uid}
                    onClick={() => onOpen(file)}
                >
                    <ListItemText
                        primary={file.title}
                        secondary={file.creator}
                    />
                </ListItemButton>
            ))}
        </List>
    );
}
