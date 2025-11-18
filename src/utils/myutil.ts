
export class MyUtil {
    /**
     * 将路径字符串进行中间省略，保留头尾以提升可读性
     */
    static truncateMiddle(str: string, head: number = 24, tail: number = 16): string {
        if (!str) return str;
        const len = str.length;
        if (len <= head + tail + 3) return str;
        const start = str.slice(0, head);
        const end = str.slice(-tail);
        return `${start}...${end}`;
    }

    /**
     * 获取笔记所属目录路径；根目录返回 "/"
     */
    static getDirPath(p: string): string {
        if (!p) return "/";
        const idx = p.lastIndexOf("/");
        if (idx === -1) return "/";
        const dir = p.slice(0, idx);
        return "/" + dir;
    }
}