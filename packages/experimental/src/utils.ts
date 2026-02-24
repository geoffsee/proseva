export interface UAOptions {
    fixedChromeVersion?: number;
    fixedFirefoxVersion?: number;
    server?: boolean;
    favorWindows?: boolean;
}

export function generateUserAgent(options: UAOptions = {}): string {
    if (typeof navigator !== 'undefined' && navigator.userAgent) {
        return navigator.userAgent;
    }
    const {
        fixedChromeVersion,
        fixedFirefoxVersion,
        server = true,
        favorWindows,
    } = options;

    const isDarwin = typeof process !== 'undefined' && process.platform === 'darwin';
    const favorWindowsFinal = favorWindows ?? !isDarwin;

    const chromeMajor = fixedChromeVersion ?? 145;
    const firefoxMajor  = fixedFirefoxVersion  ?? 147;

    const chromePatch = Math.floor(Math.random() * 100) + 7583;
    const chromeFull  = `${chromeMajor}.0.${chromePatch}.0`;

    const edgePatch = chromePatch + Math.floor(Math.random() * 40) - 20;
    const edgeFull  = `${chromeMajor}.0.${Math.max(3000, edgePatch)}.${Math.floor(Math.random()*100)}`;

    const firefoxPatch = Math.floor(Math.random() * 10);

    const platforms = [
        { weight: favorWindowsFinal ? 75 : 50, os: "Windows NT 10.0", arch: "Win64; x64", isWin: true },
        { weight: 30, os: "Macintosh; Intel Mac OS X 10_15_7", arch: "", isWin: false },
        { weight: 10, os: "Macintosh; Intel Mac OS X 14_6_1",  arch: "", isWin: false },
        { weight: 5,  os: "Macintosh; Intel Mac OS X 15_2",    arch: "", isWin: false },
        { weight: 5,  os: "X11; Linux x86_64", arch: "", isWin: false },
    ];

    if (!server) {
        platforms.push(
            { weight: 8, os: "Linux; Android 14; SM-S928B", arch: "", isWin: false },
            { weight: 4, os: "iPhone; CPU iPhone OS 18_2 like Mac OS X", arch: "", isWin: false }
        );
    }

    const totalWeight = platforms.reduce((sum, p) => sum + p.weight, 0);
    let rand = Math.random() * totalWeight;
    let selected: typeof platforms[0] | undefined;

    for (const p of platforms) {
        rand -= p.weight;
        if (rand <= 0) {
            selected = p;
            break;
        }
    }
    selected = selected ?? platforms[0];

    const { os, arch, isWin } = selected;

    const browserRoll = Math.random();
    let ua: string;

    if (browserRoll < 0.70) {
        ua = `Mozilla/5.0 (${os}${arch ? "; " + arch : ""}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeFull} Safari/537.36`;
    } else if (browserRoll < 0.88) {
        ua = `Mozilla/5.0 (${os}${arch ? "; " + arch : ""}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeFull} Safari/537.36 Edg/${edgeFull}`;
    } else {
        const geckoDate = isWin ? "20100101" : "20100101";
        ua = `Mozilla/5.0 (${os}${arch ? "; " + arch : ""}; rv:${firefoxMajor}.${firefoxPatch}) Gecko/${geckoDate} Firefox/${firefoxMajor}.${firefoxPatch}`;
    }

    return ua;
}

export function generateUserAgents(count: number = 10, options: UAOptions = {}): string[] {
    const set = new Set<string>();
    while (set.size < count) {
        set.add(generateUserAgent(options));
    }
    return Array.from(set);
}

export const presets = {
    chromeWin145: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.7632.110 Safari/537.36",
    chromeMac145: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.7632.110 Safari/537.36",
    firefoxWin147: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0",
    chromeMac1461: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.7632.110 Safari/537.36",
    edgeWin145: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.7632.110 Safari/537.36 Edg/145.0.7632.110",
} as const;

export default {
    getUserAgent: generateUserAgent,
    generateUserAgents,
    presets,
};