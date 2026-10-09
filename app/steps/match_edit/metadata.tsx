import {
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Box,
    Button,
    Typography,
    TextField,
    type TextFieldProps,
    Select,
    MenuItem,
} from "@mui/material";
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';

import { useState } from "react";
import { Language, type MetaData } from "~/hooks/models";



export default function MetaDataDialog({ defaultValue, onClose }: {
    defaultValue: MetaData;
    onClose: (newMetaData: MetaData | null) => void;
}) {
    const [metaData, setMetaData] = useState<MetaData>(defaultValue);

    return (
        <Dialog
            open
            onClose={() => onClose(null)}
            maxWidth="md"
            fullWidth
            onKeyDown={(e) => {
                if (e.key === "Enter") {
                    e.stopPropagation();
                    e.preventDefault();
                    onClose(metaData);
                }
                else if (e.key === "Escape") {
                    onClose(null);
                }
            }}
        >
            <DialogTitle>MetaData</DialogTitle>
            <DialogContent>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <MetaDataField
                        title="Title"
                        value={metaData.title}
                        onChange={(newValue) => setMetaData({ ...metaData, title: newValue })}
                        props={{
                            required: true,
                            error: metaData.title.trim() === "",
                            helperText: metaData.title.trim() === ""
                                ? "Title cannot be empty"
                                : "",
                        }}
                    />
                    <MetaDataField
                        title="Creator"
                        value={metaData.creator}
                        onChange={(newValue) => setMetaData({ ...metaData, creator: newValue })}
                    />
                    <MetaDataField
                        title="Cover"
                        value={metaData.cover}
                        onChange={(newValue) => setMetaData({ ...metaData, cover: newValue })}
                    />
                    <MetaDataField
                        title="Contributor"
                        value={metaData.contributor}
                        onChange={(newValue) => setMetaData({ ...metaData, contributor: newValue })}
                    />
                    <MetaDataField
                        title="Publisher"
                        value={metaData.publisher}
                        onChange={(newValue) => setMetaData({ ...metaData, publisher: newValue })}
                    />
                    <LocalizationProvider dateAdapter={AdapterDayjs}>
                        <MetaDataItem title="Publish Date" component={
                            <DatePicker
                                value={dayjs(metaData.date)}
                                onChange={(newValue) => setMetaData({
                                    ...metaData,
                                    date: newValue ? newValue.format("YYYY-MM-DD") : "",
                                })}
                            />
                        } />
                    </LocalizationProvider>
                    <MetaDataItem title="Language" component={
                        <Select
                            value={metaData.language ?? "None"}
                            onChange={(e) => setMetaData({
                                ...metaData,
                                language: e.target.value === "None" ? null : e.target.value,
                            })}
                            sx={{ width: 188 }}
                        >
                            <MenuItem value="None">Unset</MenuItem>
                            {Object.entries(Language).map(([key, value]) =>
                                <MenuItem key={key} value={key}>{value}</MenuItem>
                            )}
                        </Select>
                    } />
                    <MetaDataField
                        title="Description"
                        value={metaData.description}
                        onChange={(newValue) => setMetaData({ ...metaData, description: newValue })}
                        props={{
                            multiline: true,
                            minRows: 3,
                            maxRows: 8,
                            onKeyDown: (e) => {
                                if (e.key === "Enter")
                                    e.stopPropagation();
                            },
                        }}
                    />
                    <MetaDataField
                        title="Source"
                        value={metaData.source}
                        onChange={(newValue) => setMetaData({ ...metaData, source: newValue })}
                    />
                    <MetaDataField
                        title="Series Index"
                        value={(metaData.series_index ?? -1).toString()}
                        onChange={(newValue) => setMetaData({
                            ...metaData,
                            series_index: newValue.trim() === ""
                                ? null
                                : parseInt(newValue) === -1
                                    ? null
                                    : parseInt(newValue),
                        })}
                        props={{ type: "number" }}
                    />
                </Box>
            </DialogContent>
            <DialogActions>
                <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 3, p: 3 }}>
                    <Button
                        onClick={() => onClose(null)}
                        color="error"
                        variant="outlined"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={() => onClose(metaData)}
                        color="primary"
                        variant="contained"
                    >
                        Save
                    </Button>
                </Box>
            </DialogActions>
        </Dialog>
    );
}



function MetaDataItem({ title, component }: {
    title: string;
    component: React.ReactNode;
}) {
    return (
        <Box sx={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "flex-start",
        }}>
            <Typography sx={{ width: 188, flexShrink: 0 }}>
                {title}
            </Typography>
            <Box sx={{ flex: 1 }}>
                {component}
            </Box>
        </Box>
    )
}

function MetaDataField({ title, value, onChange, props }: {
    title: string;
    value: string | undefined | null;
    onChange: (newValue: string) => void;
    props?: TextFieldProps;
}) {
    return <MetaDataItem title={title} component={
        <TextField
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            fullWidth
            {...props}
        />
    } />;
}