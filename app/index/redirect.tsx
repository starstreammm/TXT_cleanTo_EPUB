import { replace } from "react-router";

export function clientLoader() {
    return replace("/path_select");
}

export default function IndexRedirect() {
    return null;
}
