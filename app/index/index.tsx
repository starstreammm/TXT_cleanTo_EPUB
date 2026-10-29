import { Box } from '@mui/material';
import { matchPath, Outlet, useLocation, useNavigate } from "react-router";

import SetpAppBar from "./appbar";
const stepPaths = ["/", "/match-edit", "/convert-options", "/results"];

export default function StepLayout() {
    const { pathname } = useLocation();
    const navigate = useNavigate();
    const activeStep = stepPaths.findIndex((path) => matchPath(path, pathname));

    return (
        <>
            <SetpAppBar
                step={activeStep}
                onBack={() => void navigate(stepPaths[Math.max(activeStep - 1, 0)])}
            />

            <Box sx={{
                position: "absolute",
                top: 68,
                left: 0,
                right: 0,
                bottom: 0,

                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: (theme) => theme.vars?.palette.background.default,
            }}>
                <Outlet />
            </Box>
        </>
    );
}
