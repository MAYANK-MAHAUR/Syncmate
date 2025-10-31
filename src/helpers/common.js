

export function parseJsonGarbage(s) {
    s = s.slice(s.search(/[{[]/));
    try {
        return JSON.parse(s);
    } catch (e) {
        if (e instanceof SyntaxError) {
            return JSON.parse(s.slice(0, e.message.match(/position (\d+)/)[1]));
        }
        throw e;
    }
}

export function extractSlugs(url) {
    const slugs = url.split('/').filter(Boolean);
    return slugs;
}

