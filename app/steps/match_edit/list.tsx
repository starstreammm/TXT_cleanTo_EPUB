import { List, ListItemButton, ListItemText } from "@mui/material";
import { useState } from "react";
import type { FileInfo } from "~/hooks/models";



export default function FileList({ files, onOpen }: {
    files: FileInfo[];
    onOpen: (file: FileInfo) => void;
}) {
    const [open, setOpen] = useState(-1);

    return (
        <List sx={{ width: "100%", height: "100%" }}>
            {files.map((file, index) =>
                <ListItemButton
                    key={index}
                    selected={open === index}
                    onClick={() => { onOpen(file); setOpen(index); }}
                >
                    <ListItemText
                        primary={file.title}
                        secondary={file.creator}
                    />
                </ListItemButton>
            )}
        </List>
    );
}