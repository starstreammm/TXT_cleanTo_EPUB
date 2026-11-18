import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
    index("index/redirect.tsx"),
    layout("index/index.tsx", [
        route("path_select", "steps/path_select/index.tsx"),
        route("match-edit", "steps/match_edit/index.tsx"),
        route("convert-options", "steps/tran_config/index.tsx"),
        route("results", "steps/progress_result/index.tsx"),
    ]),
] satisfies RouteConfig;
