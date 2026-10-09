import { Backdrop, Typography } from "@mui/material"
import { useQuery } from "@tanstack/react-query"
import { api } from "~/hooks/api"


export default function ApiDisconnectBackdrop() {
    const { data: bool = true } = useQuery({
        queryKey: ["health"],
        queryFn: () => api.get("/api/health"),
        retry: 0,
        refetchInterval: 3000,
        refetchIntervalInBackground: true,
    })

    if (bool)
        return null;
    else
        return (
            <Backdrop
                open
                sx={{
                    color: '#fff',
                    flexDirection: "column",
                    display: "flex",
                    justifyContent: "space-evenly",
                    alignItems: "center",
                    zIndex: 9999,
                }}
            >
                <Typography variant="h3">无法连接到服务器，请检查后端服务器状态</Typography>
            </Backdrop>
        );
}