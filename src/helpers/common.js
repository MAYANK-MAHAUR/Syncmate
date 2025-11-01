export function parseJsonGarbage(s) {
    if (!s || typeof s !== 'string') {
        throw new Error('Invalid input: expected string');
    }

    s = s.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    
    s = s.trim();
    
    const jsonStart = s.search(/[{[]/);
    if (jsonStart === -1) {
        throw new Error('No JSON found in response');
    }
    
    s = s.slice(jsonStart);
    
    try {
        return JSON.parse(s);
    } catch (e) {
        if (e instanceof SyntaxError) {
            const match = e.message.match(/position (\d+)/);
            if (match) {
                const position = parseInt(match[1]);
                try {
                    return JSON.parse(s.slice(0, position));
                } catch (innerError) {
                    return extractJsonObject(s);
                }
            }
        }
        throw e;
    }
}

function extractJsonObject(s) {
    let depth = 0;
    let inString = false;
    let escaped = false;
    let startIndex = -1;
    
    for (let i = 0; i < s.length; i++) {
        const char = s[i];
        
        if (escaped) {
            escaped = false;
            continue;
        }
        
        if (char === '\\') {
            escaped = true;
            continue;
        }
        
        if (char === '"') {
            inString = !inString;
            continue;
        }
        
        if (inString) continue;
        
        if (char === '{') {
            if (depth === 0) startIndex = i;
            depth++;
        } else if (char === '}') {
            depth--;
            if (depth === 0 && startIndex !== -1) {
                try {
                    return JSON.parse(s.substring(startIndex, i + 1));
                } catch (e) {
                }
            }
        }
    }
    
    throw new Error('Could not extract valid JSON from response');
}

export function validateJsonStructure(obj, requiredKeys = []) {
    if (!obj || typeof obj !== 'object') {
        return { valid: false, error: 'Not an object' };
    }
    
    const missing = requiredKeys.filter(key => !(key in obj));
    if (missing.length > 0) {
        return { 
            valid: false, 
            error: `Missing required keys: ${missing.join(', ')}` 
        };
    }
    
    return { valid: true };
}

export function extractSlugs(url) {
    const slugs = url.split('/').filter(Boolean);
    return slugs;
}

export function parseGitHubRepo(text) {
    const directMatch = text.match(/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+)/);
    if (directMatch) {
        return {
            owner: directMatch[1],
            repo: directMatch[2]
        };
    }
    
    const urlMatch = text.match(/github\.com\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+)/);
    if (urlMatch) {
        return {
            owner: urlMatch[1],
            repo: urlMatch[2]
        };
    }
    
    const repoMatch = text.match(/the\s+([a-zA-Z0-9_-]+)\s+repository/i);
    if (repoMatch) {
        return {
            repo: repoMatch[1],
            needsOwner: true
        };
    }
    
    return null;
}

export function parseEmailInfo(text) {
    const result = {};
    
    const emailMatch = text.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
    if (emailMatch) {
        result.to = emailMatch[1];
    }
    
    const subjectMatch = text.match(/(?:subject|titled?)[\s:]+["']?([^"'\n]+)["']?/i);
    if (subjectMatch) {
        result.subject = subjectMatch[1].trim();
    }
    
    const bodyMatch = text.match(/(?:body|message|saying|with)[\s:]+["']?([^"'\n]+)["']?/i);
    if (bodyMatch) {
        result.body = bodyMatch[1].trim();
    }
    
    return result;
}

export function normalizeText(text) {
    if (!text) return '';
    
    return text
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/["'"]/g, '"')
        .replace(/[–—]/g, '-');
}

export async function retryWithBackoff(fn, maxRetries = 3, initialDelay = 1000) {
    let lastError;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            
            if (attempt < maxRetries) {
                const delay = initialDelay * Math.pow(2, attempt);
                console.log(`Retry attempt ${attempt + 1} after ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    
    throw lastError;
}