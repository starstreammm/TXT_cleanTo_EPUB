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
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { pushError } from "~/components/error_popout";
import NavigateNextRoundedIcon from "@mui/icons-material/NavigateNextRounded";
import type { TranConfig } from "~/hooks/models";
import { api } from "~/hooks/api";
import { useLocalStorage } from "~/hooks/storage";
import PathSelector from "~/components/pathselector";

export default function TranConfig({ onNext }: { onNext: () => void }) {
    const [starting, setStarting] = useState(false);
    const queryClient = useQueryClient();
    const [config, setConfig] = useLocalStorage<TranConfig>(
        "tran_config",
        {
            output: "/",
            save_text: false,
            move_images: false,
            del_origin: true,
        },
        "local",
    );

    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                width: "100%",
                height: "100%",
                p: 3,
            }}
        >
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
                            onClose={(value) =>
                                setConfig({ ...config, output: value })
                            }
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
                            onChange={(e) =>
                                setConfig({
                                    ...config,
                                    save_text: e.target.checked,
                                })
                            }
                        />
                    </ListItemIcon>
                </ListItem>
                <ListItem>
                    <ListItemText
                        primary="Move Images"
                        secondary="Move the cover and local images beside the output as cover, P1, P2, etc., keeping their extensions. Markdown uses relative paths. Source images are removed after all conversions succeed."
                    />
                    <ListItemIcon>
                        <Switch
                            checked={config.move_images ?? false}
                            onChange={(e) =>
                                setConfig({
                                    ...config,
                                    move_images: e.target.checked,
                                })
                            }
                            slotProps={{
                                input: { "aria-label": "Move Images" },
                            }}
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
                            onChange={(e) =>
                                setConfig({
                                    ...config,
                                    del_origin: e.target.checked,
                                })
                            }
                        />
                    </ListItemIcon>
                </ListItem>
            </List>
            <Box
                sx={{
                    display: "flex",
                    justifyContent: "flex-end",
                    mt: 3,
                }}
            >
                <Button
                    variant="contained"
                    loading={starting}
                    onClick={async () => {
                        setStarting(true);
                        try {
                            await api.post("/api/task/run", {
                                json: {
                                    output: config.output,
                                    save_text: config.save_text,
                                    move_images: config.move_images ?? false,
                                    del_origin: config.del_origin,
                                },
                            });
                            queryClient.setQueryData(["progress"], []);
                            queryClient.setQueryData(["done"], false);
                            onNext();
                        } catch (error) {
                            pushError(error, "Start transformation");
                        } finally {
                            setStarting(false);
                        }
                    }}
                    endIcon={<NavigateNextRoundedIcon />}
                >
                    Start Transformation
                </Button>
            </Box>
        </Box>
    );
}
