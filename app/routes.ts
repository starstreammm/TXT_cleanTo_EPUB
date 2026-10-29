import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
    layout("index/index.tsx", [
        index("pages/path-select.tsx"),
        route("match-edit", "pages/match-edit.tsx"),
        route("convert-options", "pages/convert-options.tsx"),
        route("results", "steps/progress_result/index.tsx"),
    ]),
] satisfies RouteConfig;
