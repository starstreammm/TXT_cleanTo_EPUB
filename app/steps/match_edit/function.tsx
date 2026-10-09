import type { FileInfo, MetaData } from "~/hooks/models";
import { api } from "~/hooks/api";
import { pushError, pushMsg } from "~/components/error_popout";



export async function* getContent(uid: string): AsyncGenerator<string> {
    try {
        const decoder = new TextDecoder();
        const reader = (
            await api.get("/api/file/open", {
                searchParams: { uid },
                timeout: false
            })).body?.getReader();
        if (reader === undefined) {
            pushMsg("Response body is empty", "error");
            throw new Error("Response body is empty");
        }

        while (true) {
            const { value, done } = await reader.read();

            if (done) break;

            yield decoder.decode(value, { stream: true });
        }

        const remaining = decoder.decode();
        if (remaining)
            yield remaining;

    } catch (error) {
        pushError(error, "Get account posts");
        throw error;
    }
}

export async function getFormated(text: string, signal?: AbortSignal): Promise<string> {
    try {
        const res = await api.post("/api/file/preview", {
            json: { text }, signal,
        }).json<string>();
        return res;
    }
    catch (error) {
        if (error.name !== "AbortError")
            pushError(error, "Format file");
        throw error;
    }
}


export async function fetchFileList() {
    try {
        const res = await api.get("/api/file/list").json<FileInfo[]>();
        return res;
    }
    catch (error) {
        pushError(error, "Fetch file list");
        throw error;
    }
}


export async function updateMetaData(uid: string, metadata: MetaData) {
    try {
        await api.post("/api/file/update/metadata", {
            json: metadata,
            searchParams: { uid },
        });
    }
    catch (error) {
        pushError(error, "Update metadata");
        throw error;
    }
}