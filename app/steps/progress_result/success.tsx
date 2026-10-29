import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import "./success.css";

export default function AppleSuccess() {
    const navigate = useNavigate();
    const [animate, setAnimate] = useState(false);

    useEffect(() => {
        requestAnimationFrame(() => setAnimate(true));
    }, []);

    return (
        <div
            className="success-overlay"
            onClick={() => {
                if (animate) void navigate("/", { replace: true });
            }}
        >
            <div className={`success-card ${animate ? "show" : ""}`}>
                <svg viewBox="0 0 56 56" className="success-icon">
                    <circle cx="28" cy="28" r="25" className="circle" />
                    <path d="M16 29 L24 37 L40 20" className="check" />
                </svg>

                <div className="title">Success</div>
                <div className="subtitle">
                    Click anywhere to return to Step 1
                </div>
            </div>
        </div>
    );
}
