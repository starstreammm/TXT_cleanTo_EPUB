export const VERSION = "v1.2.0";
export const Language: Record<string, string> = {
    zh: "中文",
    en: "English",
    ja: "日本語",
    ko: "한국어",
    fr: "Français",
    de: "Deutsch",
    es: "Español",
    it: "Italiano",
    pt: "Português",
    ru: "Русский",
    ar: "العربية",
    hi: "हिन्दी",
    th: "ไทย",
    vi: "Tiếng Việt",
    id: "Bahasa Indonesia",
    tr: "Türkçe",
    nl: "Nederlands",
    pl: "Polski",
    sv: "Svenska",
    da: "Dansk",
    no: "Norsk",
    fi: "Suomi",
};

export interface TranConfig {
    output: string;

    save_text: boolean;
    move_images: boolean;
    del_origin: boolean;
}

export interface ApiExecuteResponse {
    uid: string;
    filename: string;
    progress: number;
    error: string | null;
    warning?: string | null;
}

export interface MetaData {
    title: string;
    creator?: string | null;
    contributor?: string | null;
    publisher?: string | null;
    date: string;
    language?: string | null;
    description?: string | null;
    source?: string | null;
    cover?: string | null;
}

export interface ApiUpdateFileInfo extends MetaData {
    uid: string;
    filename: string;
}

export interface FileInfo extends ApiUpdateFileInfo {
    type: "txt" | "md";
    source_name: string;
    size: number;
    modified_at: string;
}

export interface PathEntry {
    name: string;
    is_file: boolean;
}

export interface Pattern {
    enable: boolean;
    alias: string;
    pattern: string;
    replacement?: string | null;
}
