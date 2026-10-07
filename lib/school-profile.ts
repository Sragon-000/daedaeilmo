export type SchoolProfile = { name: string; studentId: string };

// Decode a quoted JS string without executing school-provided code.
function literalValue(source: string): string | null {
  const quote = source[0];
  if (quote !== '"' && quote !== "'") return null;
  let out = '';
  for (let i = 1; i < source.length; i++) {
    const char = source[i];
    if (char === quote) return out;
    if (char !== '\\') {
      out += char;
      continue;
    }
    const escaped = source[++i];
    if (escaped === 'u' || escaped === 'x') {
      const length = escaped === 'u' ? 4 : 2;
      const hex = source.slice(i + 1, i + 1 + length);
      if (!new RegExp(`^[a-f0-9]{${length}}$`, 'i').test(hex)) return null;
      out += String.fromCharCode(parseInt(hex, 16));
      i += length;
    } else {
      const escapes: Record<string, string> = {
        n: '\n',
        r: '\r',
        t: '\t',
        b: '\b',
        f: '\f',
        '\\': '\\',
        '"': '"',
        "'": "'",
        '/': '/',
      };
      if (!(escaped in escapes)) return null;
      out += escapes[escaped];
    }
  }
  return null;
}
export function parseSchoolUser(html: string): unknown {
  const assignments = [...html.matchAll(/\bgv_sessionUser\s*=\s*/g)];
  for (const match of assignments.reverse()) {
    const parsed = parseUserAssignment(
      html.slice(match.index + match[0].length),
    );
    if (parsed && typeof parsed === 'object' && Object.keys(parsed).length)
      return parsed;
  }
  return null;
}
function parseUserAssignment(input: string): unknown {
  let source = input.trimStart();
  for (let depth = 0; depth < 6; depth++) {
    const wrapper =
      /^(?:JSON\.parse|\$\.parseJSON|decodeURIComponent|unescape|atob|window\.atob|Base64\.decode)\(\s*/.exec(
        source,
      );
    if (!wrapper) break;
    source = source.slice(wrapper[0].length).trimStart();
  }
  let value: unknown =
    source[0] === '"' || source[0] === "'" ? literalValue(source) : null;
  if (value === null && source.startsWith('{')) {
    // Only JSON object literals are accepted, never arbitrary JavaScript.
    for (
      let end = source.indexOf('}');
      end >= 0;
      end = source.indexOf('}', end + 1)
    ) {
      try {
        value = JSON.parse(source.slice(0, end + 1));
        break;
      } catch {
        /* next closing brace */
      }
    }
  }
  for (let pass = 0; pass < 3 && typeof value === 'string'; pass++) {
    const text = value.trim();
    try {
      value = JSON.parse(text);
      continue;
    } catch {
      /* encoded JSON below */
    }
    if (text.startsWith('%7B') || text.startsWith('%7b')) {
      try {
        value = decodeURIComponent(text);
        continue;
      } catch {
        return null;
      }
    }
    if (text.includes('&quot;') || text.includes('&#34;')) {
      value = text
        .replace(/&quot;|&#34;/g, '"')
        .replace(/&#39;|&apos;/g, "'")
        .replace(/&amp;/g, '&');
      continue;
    }
    if (/^[A-Za-z0-9+/]+={0,2}$/.test(text)) {
      try {
        const decoded = Buffer.from(text, 'base64').toString('utf8');
        if (decoded.trim().startsWith('{')) {
          value = decoded;
          continue;
        }
      } catch {
        /* unsupported encoding */
      }
    }
    return null;
  }
  return value && typeof value === 'object' ? value : null;
}
export function schoolProfileFromUser(value: unknown): SchoolProfile | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const nameKeys = [
    'USER_NM',
    'USER_NAME',
    'USER_KOR_NM',
    'userNm',
    'userName',
    'user_nm',
    'NAME',
    'name',
    'NM',
  ];
  const idKeys = [
    'STUDENT_NO',
    'HAKBUN',
    'USER_ID',
    'USER_NO',
    'studentId',
    'hakbun',
    'userId',
    'user_id',
  ];
  const name = nameKeys
    .map((key) => record[key])
    .find((v) => typeof v === 'string' && v.trim());
  const id = idKeys
    .map((key) => record[key])
    .find((v) => typeof v === 'string' || typeof v === 'number');
  if (typeof name !== 'string' || id === undefined) return null;
  const studentId = String(id).trim();
  if (
    !name.trim() ||
    name.length > 80 ||
    Array.from(name).some((char) => char.charCodeAt(0) < 32) ||
    /[<>]/.test(name) ||
    !/^[A-Za-z0-9_-]{1,40}$/.test(studentId)
  )
    return null;
  return { name: name.trim(), studentId };
}
