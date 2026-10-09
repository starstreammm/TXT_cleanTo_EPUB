import {
    AppBar,
    Avatar,
    Box,
    Button,
    IconButton,
    Step,
    StepLabel,
    Stepper,
    useMediaQuery,
    useTheme,
} from "@mui/material";
import { useColorScheme } from '@mui/material/styles';
import NavigateBeforeRoundedIcon from '@mui/icons-material/NavigateBeforeRounded';
import ContrastRoundedIcon from '@mui/icons-material/ContrastRounded';

import { type Dispatch, type SetStateAction } from "react";

import { useLocalStorage } from "~/hooks/storage";



export default function SetpAppBar({ step, setStep }: {
    step: number;
    setStep: Dispatch<SetStateAction<number>>;
}) {
    const theme = useTheme();
    const { mode, setMode } = useColorScheme();
    const preferIsDark = useMediaQuery("(prefers-color-scheme: dark)");
    const [themeMode, setThemeMode] = useLocalStorage<'light' | 'dark' | 'system'>('theme-mode', 'system', 'local');

    const changeThemeMode = () => {
        let newMode: 'light' | 'dark' | 'system' = themeMode;
        if (themeMode === 'system') {
            newMode = preferIsDark ? 'light' : 'dark';
        }
        else if (themeMode === 'light') {
            newMode = preferIsDark ? 'system' : 'dark';
        }
        else if (themeMode === 'dark') {
            newMode = preferIsDark ? 'light' : 'system';
        }
        setMode(newMode);
        setThemeMode(newMode);
    }

    return (
        <AppBar
            position="fixed"
            sx={{
                height: 68,
                transition: theme.transitions.create(["background-color", "box-shadow", "border-color", "color"])
            }}
        >
            <Box sx={{
                px: 3,
                width: "100%",
                height: "100%",
                display: 'flex',
                justifyContent: "space-between",
                alignItems: "center",
            }}>
                <Box sx={{
                    display: 'flex',
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 3,
                }}>
                    <Avatar alt="TtE" src="/Icon-rounded.svg" variant="rounded" />
                    <Stepper activeStep={step} >
                        {["Choose Work Path", "Match Format and Edit", "Set Convert Options", "Complete"].map((text, index) => (
                            <Step key={index}>
                                <StepLabel
                                    sx={{
                                        "& .MuiStepIcon-root": {
                                            fontSize: 33,
                                            color: theme.vars?.palette.background.paper,
                                        },
                                        "& .MuiStepIcon-root.Mui-active": {
                                            fontSize: 33,
                                            color: theme.vars?.palette.secondary.main,
                                        },
                                        "& .MuiStepIcon-root.Mui-completed": {
                                            fontSize: 33,
                                            color: theme.vars?.palette.primary.dark,
                                        },

                                        "& .MuiStepIcon-text": {
                                            fontSize: 13,
                                            fill: theme.vars?.palette.text.primary,
                                        },

                                        "& .MuiStepLabel-label": {
                                            fontSize: 18,
                                            color: theme.vars?.palette.text.primary,
                                        }
                                    }}
                                >
                                    {text}
                                </StepLabel>
                            </Step>
                        ))}
                    </Stepper>
                    <Button
                        variant="contained"
                        startIcon={<NavigateBeforeRoundedIcon />}
                        onClick={() => { setStep(prev => Math.max(prev - 1, 0)); }}
                        color="secondary"
                        disabled={step === 0}
                    >
                        Back
                    </Button>
                </Box>
                <IconButton onClick={() => changeThemeMode()}>
                    <ContrastRoundedIcon />
                </IconButton>
            </Box>
        </AppBar >
    )
}