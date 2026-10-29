import { useNavigate } from "react-router";
import PathSelect from "~/steps/path_select";

export default function PathSelectPage() {
    const navigate = useNavigate();

    return <PathSelect onNext={() => void navigate("/match-edit")} />;
}
