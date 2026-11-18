export function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    const units = ["KiB", "MiB", "GiB", "TiB"];
    const index = Math.min(
        Math.floor(Math.log2(bytes) / 10) - 1,
        units.length - 1,
    );
    return `${(bytes / 1024 ** (index + 1)).toLocaleString(undefined, {
        maximumFractionDigits: 2,
    })} ${units[index]}`;
}
