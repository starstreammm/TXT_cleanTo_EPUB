import {
    Box,
    Typography,
    List,
    ListItem,
    ListItemText,
    ListItemIcon,
    Switch,
    Button,
} from "@mui/material";
import NavigateNextRoundedIcon from '@mui/icons-material/NavigateNextRounded';
import type { TranConfig } from "~/hooks/models";
import { api } from "~/hooks/api";
import { useLocalStorage } from "~/hooks/storage";
import PathSelector from "~/components/pathselector";


export default function TranConfig({ onNext }: { onNext: () => void }) {
    const [config, setConfig] = useLocalStorage<TranConfig>("tran_config", {
        output: "/",
        chapter_separatly: false,
        volume_separatly: false,
        save_text: false,
        del_origin: true,
    }, "local");


    return (
        <Box sx={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
            height: "100%",
            p: 3,
        }}>
            <Typography variant="h5" sx={{ mb: 3 }}>
                Transformation Configuration
            </Typography>
            <List sx={{ flex: 1 }}>
                <ListItem>
                    <ListItemText
                        primary="Output Path"
                        secondary="The path where the output Markdown & EPUB files will be saved."
                    />
                    <ListItemIcon sx={{ width: "38vw", minWidth: 333 }}>
                        <PathSelector
                            value={config.output}
                            onClose={(value) => setConfig({ ...config, output: value })}
                            addDir
                        />
                    </ListItemIcon>
                </ListItem>
                <ListItem sx={{ mt: 3 }}>
                    <ListItemText
                        primary="Save Text Files"
                        secondary="Whether to save the generated markdown file(s) after transformation to EPUB."
                    />
                    <ListItemIcon>
                        <Switch
                            checked={config.save_text}
                            onChange={(e) => setConfig({ ...config, save_text: e.target.checked })}
                        />
                    </ListItemIcon>
                </ListItem>
                <ListItem>
                    <ListItemText
                        primary="Delete Original File"
                        secondary="Whether to delete the original input file after transformation to EPUB."
                    />
                    <ListItemIcon>
                        <Switch
                            checked={config.del_origin}
                            onChange={(e) => setConfig({ ...config, del_origin: e.target.checked })}
                        />
                    </ListItemIcon>
                </ListItem>
                <ListItem sx={{ mt: 3 }}>
                    <ListItemText
                        primary="Separated by Volumes"
                        secondary="Save the text into separate files for each volume. They will be saved in folders named v01, v02, etc and with filename _v01, _v02, etc."
                    />
                    <ListItemIcon>
                        <Switch
                            checked={config.volume_separatly}
                            onChange={(e) => setConfig({ ...config, volume_separatly: e.target.checked })}
                        />
                    </ListItemIcon>
                </ListItem>
                <ListItem>
                    <ListItemText
                        primary="Separated by Chapters"
                        secondary="Save the text into separate files for each chapter. They will be saved in files named _c0001, _c0002, etc."
                    />
                    <ListItemIcon>
                        <Switch
                            checked={config.chapter_separatly}
                            onChange={(e) => setConfig({ ...config, chapter_separatly: e.target.checked })}
                        />
                    </ListItemIcon>
                </ListItem>
            </List>
            <Box sx={{
                display: "flex",
                justifyContent: "flex-end",
                mt: 3,
            }}>
                <Button
                    variant="contained"
                    onClick={() => api.post("/api/task/run", {
                        json: config,
                    }).then(onNext)}
                    endIcon={<NavigateNextRoundedIcon />}
                >
                    Start Transformation
                </Button>
            </Box>
        </Box>
    )
}