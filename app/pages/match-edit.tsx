import { useNavigate } from "react-router";
import MatchAndEdit from "~/steps/match_edit/index";

export default function MatchEditPage() {
    const navigate = useNavigate();

    return <MatchAndEdit onNext={() => void navigate("/convert-options")} />;
}
