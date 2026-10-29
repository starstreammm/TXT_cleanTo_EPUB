import { useNavigate } from "react-router";
import TranConfig from "~/steps/tran_config";

export default function ConvertOptionsPage() {
    const navigate = useNavigate();

    return <TranConfig onNext={() => void navigate("/results")} />;
}
