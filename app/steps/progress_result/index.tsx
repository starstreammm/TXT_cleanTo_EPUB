import {
    Box,
    Button,
    Typography,
    LinearProgress,
    TableContainer,
    Table,
    TableHead,
    TableRow,
    TableCell,
    TableBody,
} from "@mui/material";
import { useEffect, useRef, useState } from "react";
import { pushError } from "~/components/error_popout";
import ReplayRoundedIcon from "@mui/icons-material/ReplayRounded";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ApiExecuteResponse } from "~/hooks/models";
import { api } from "~/hooks/api";
import AppleSuccess from "./success";

function recognizeStatus(progress: ApiExecuteResponse) {
    if (progress.error) return ["ERROR", "error"] as const;

    if (progress.progress === 100) return ["SUCCESS", "success"] as const;

    if (progress.progress === 0) return ["PREPARING", "info"] as const;

    return ["PROCESSING", "primary"] as const;
}

export default function ProgressResult() {
    const queryClient = useQueryClient();
    const [retrying, setRetrying] = useState(false);
    const { data: progress = [] } = useQuery({
        queryKey: ["progress"],
        meta: { errorContext: "Load conversion progress", polling: true },
        queryFn: () =>
            api.get("/api/task/progress").json<ApiExecuteResponse[]>(),
        retry: 0,
        refetchInterval: 333,
        refetchIntervalInBackground: false,
    });

    const { data: done = false } = useQuery({
        queryKey: ["done"],
        meta: { errorContext: "Check conversion status", polling: true },
        queryFn: () => api.get("/api/task/done").json<boolean>(),
        retry: 0,
        refetchInterval: 888,
        refetchIntervalInBackground: true,
    });

    const reportedFailures = useRef(new Map<string, string>());
    useEffect(() => {
        const current = new Map<string, string>();
        for (const item of progress) {
            if (!item.error) continue;
            current.set(item.uid, item.error);
            if (reportedFailures.current.get(item.uid) !== item.error) {
                pushError(item.error, item.filename);
            }
        }
        reportedFailures.current = current;
    }, [progress]);

    const failedCount = progress.filter((item) => item.error).length;
    const retryFailed = async () => {
        setRetrying(true);
        try {
            await api.post("/api/task/retry");
            queryClient.setQueryData(["done"], false);
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ["progress"] }),
                queryClient.invalidateQueries({ queryKey: ["done"] }),
            ]);
        } catch (error) {
            pushError(error, "Retry failed files");
        } finally {
            setRetrying(false);
        }
    };

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
            {done && progress.length > 0 && !failedCount && <AppleSuccess />}
            <Typography variant="h5" sx={{ mb: 1 }}>
                Transformation Results
            </Typography>
            <TableContainer>
                <Table
                    stickyHeader
                    sx={{
                        width: "100%",
                        tableLayout: "auto",

                        "& .col-1": {
                            width: "38%",
                            overflowWrap: "anywhere",
                            wordBreak: "break-word",
                        },

                        "& .col-2": {
                            width: "62%",
                            overflowWrap: "anywhere",
                            wordBreak: "break-word",
                        },

                        "& .no-wrap": {
                            whiteSpace: "nowrap",
                        },
                    }}
                >
                    <TableHead>
                        <TableRow>
                            <TableCell>File Name</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>Progress</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {progress.map((item) => (
                            <TableRow key={item.uid}>
                                <TableCell className="col-1">
                                    {item.filename}
                                    {item.warning && (
                                        <Typography variant="body2" color="warning.main">
                                            {item.warning}
                                        </Typography>
                                    )}
                                </TableCell>
                                <TableCell className="no-wrap">
                                    {item.error ? (
                                        <Button
                                            size="small"
                                            color="error"
                                            onClick={() => pushError(item.error, item.filename)}
                                        >
                                            Show error
                                        </Button>
                                    ) : (
                                        <Typography
                                            variant="body2"
                                            sx={{
                                                color: `${recognizeStatus(item)[1]}.main`,
                                                fontWeight: "bold",
                                            }}
                                        >
                                            {recognizeStatus(item)[0]}
                                        </Typography>
                                    )}
                                </TableCell>
                                <TableCell className="col-2">
                                    <Box
                                        sx={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 3,
                                        }}
                                    >
                                        <LinearProgress
                                            color={recognizeStatus(item)[1]}
                                            variant={
                                                recognizeStatus(item)[0] ===
                                                "PREPARING"
                                                    ? "indeterminate"
                                                    : "determinate"
                                            }
                                            value={item.progress}
                                            sx={{ width: "100%" }}
                                        />
                                        <Typography
                                            variant="body2"
                                            sx={{ width: 68 }}
                                        >
                                            {item.progress}%
                                        </Typography>
                                    </Box>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
            {failedCount > 0 && (
                <Box
                    sx={{ display: "flex", justifyContent: "flex-end", mt: 3 }}
                >
                    <Button
                        variant="contained"
                        startIcon={<ReplayRoundedIcon />}
                        loading={retrying}
                        disabled={!done}
                        onClick={() => void retryFailed()}
                    >
                        Retry Failed Files ({failedCount})
                    </Button>
                </Box>
            )}
        </Box>
    );
}
