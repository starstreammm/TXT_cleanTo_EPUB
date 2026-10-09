import { Box } from '@mui/material';
import { useState } from "react";

import SetpAppBar from "./appbar";
import PathSelector from '~/steps/path_select';
import MatchAndEdit from '~/steps/match_edit/index';
import TranConfig from '~/steps/tran_config';
import ProgressResult from '~/steps/progress_result/index';



export default function Home() {
    // Path & ls state
    const [activeStep, setActiveStep] = useState(0);


    return (
        <>
            <SetpAppBar step={activeStep} setStep={setActiveStep} />

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
                {activeStep === 0 && <PathSelector onNext={() => setActiveStep(1)} />}
                {activeStep === 1 && <MatchAndEdit onNext={() => setActiveStep(2)} />}
                {activeStep === 2 && <TranConfig onNext={() => setActiveStep(3)} />}
                {activeStep === 3 && <ProgressResult />}
            </Box>
        </>
    );
}
