export const TEXT_SUFFIXES = [".txt", ".md"] as const;
export const PIC_SUFFIXES = [
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".svg",
    ".webp",
] as const;
export const SUPPORTED_SUFFIXES = [
    ...TEXT_SUFFIXES,
    ...PIC_SUFFIXES,
] as const;
export type PatternType = "file" | "chapter" | "adv" | "volume";
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

    chapter_separatly: boolean;
    volume_separatly: boolean;

    save_text: boolean;
    del_origin: boolean;
}

export interface ApiExecuteResponse {
    filename: string;
    progress: number;
    error: string | null;
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
    series_index?: number | null;
    cover?: string | null;
}

export interface ApiUpdateFileInfo extends MetaData {
    uid: string;
    filename: string;
}

export interface FileInfo extends ApiUpdateFileInfo {
    type: "txt" | "md";
}

export interface TextLineChange {
    /** Begin at 1. */
    line_number: number;

    /** Without \n at the end. */
    new_content: string;
}

export interface Pattern {
    enable: boolean;
    alias: string;
    pattern: string;
}