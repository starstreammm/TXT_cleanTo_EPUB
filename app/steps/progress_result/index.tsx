import {
    Box,
    Typography,
    LinearProgress,
    TableContainer,
    Table,
    TableHead,
    TableRow,
    TableCell,
    TableBody,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import type { ApiExecuteResponse } from "~/hooks/models";
import { api } from "~/hooks/api";
import AppleSuccess from "./success";


function recognizeStatus(progress: ApiExecuteResponse) {
    if (progress.error)
        return ["ERROR", "error"] as const;

    if (progress.progress === 100)
        return ["SUCCESS", "success"] as const;

    if (progress.progress === 0)
        return ["PREPARING", "info"] as const;

    return ["PROCESSING", "primary"] as const;
}


export default function ProgressResult() {
    const { data: progress = [] } = useQuery({
        queryKey: ["progress"],
        queryFn: () => api.get("/api/task/progress").json<ApiExecuteResponse[]>(),
        retry: 0,
        refetchInterval: 333,
        refetchIntervalInBackground: false,
    });

    const { data: done = false } = useQuery({
        queryKey: ["done"],
        queryFn: () => api.get("/api/task/done").json<boolean>(),
        retry: 0,
        refetchInterval: 888,
        refetchIntervalInBackground: true,
    });

    /* Test data for development purposes */
    /*
    const progress: ApiExecuteResponse[] = [
        {
            filename: "novel_001.txt",
            progress: 0,
            error: null,
        },
        {
            filename: "novel_002.txt",
            progress: 23.5,
            error: null,
        },
        {
            filename: "novel_003.txt",
            progress: 56.8,
            error: null,
        },
        {
            filename: "novel_004.txt",
            progress: 87.2,
            error: null,
        },
        {
            filename: "novel_005.txt",
            progress: 100,
            error: null,
        },
        {
            filename: "novel_006.txt",
            progress: 42.7,
            error: "Failed to read input file.",
        },
        {
            filename: "novel_007.txt",
            progress: 100,
            error: "EPUB generation failed.",
        },
        {
            filename: "novel_008.txt",
            progress: 3.2,
            error: null,
        },
    ];
    */


    return (
        <Box sx={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
            height: "100%",
            p: 3,
        }}>
            {done && <AppleSuccess />}
            <Typography variant="h5" sx={{ mb: 1 }}>
                Transformation Configuration
            </Typography>
            <TableContainer>
                <Table stickyHeader sx={{
                    width: "100%",
                    tableLayout: 'auto',

                    '& .col-1': {
                        width: '38%',
                        overflowWrap: 'anywhere',
                        wordBreak: 'break-word',
                    },

                    '& .col-2': {
                        width: '62%',
                        overflowWrap: 'anywhere',
                        wordBreak: 'break-word',
                    },

                    '& .no-wrap': {
                        whiteSpace: 'nowrap',
                    },
                }}>
                    <TableHead>
                        <TableRow>
                            <TableCell>File Name</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>Progress</TableCell>
                            <TableCell />
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {progress.map((item) => (
                            <TableRow key={item.filename}>
                                <TableCell className="col-1">{item.filename}</TableCell>
                                <TableCell className="no-wrap">
                                    <Typography variant="body2" sx={{ color: `${recognizeStatus(item)[1]}.main`, fontWeight: "bold" }}>
                                        {recognizeStatus(item)[0]}
                                    </Typography>
                                </TableCell>
                                <TableCell className={item.error ? "no-wrap" : "col-2"} colSpan={item.error ? undefined : 2}>
                                    <Box sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 3,
                                    }}>
                                        <LinearProgress
                                            color={recognizeStatus(item)[1]}
                                            variant={recognizeStatus(item)[0] === "PREPARING" ? "indeterminate" : "determinate"}
                                            value={item.progress}
                                            sx={{ width: item.error ? 300 : "100%" }}
                                        />
                                        <Typography variant="body2" sx={{ width: 68 }}>
                                            {item.progress}%
                                        </Typography>
                                    </Box>
                                </TableCell>
                                {item.error &&
                                    <TableCell className="col-2">
                                        <Typography variant="body2" sx={{ color: "error.main" }}>
                                            {item.error}
                                        </Typography>
                                    </TableCell>
                                }
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box >
    )
}