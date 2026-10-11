// Gelato downloads the print file from a public address, so the painting has to sit
// somewhere on the web for as long as the product lives.
//
//   GitHub (preferred): the file is committed to a public repo and served from
//     raw.githubusercontent.com. Heavy files stay on GitHub, as the site does.
//     Needs GITHUB_REPO ("owner/name"), GITHUB_TOKEN (a fine-grained token with
//     Contents: read and write on that one repo), optional GITHUB_BRANCH and GITHUB_DIR.
//   KV (fallback, and for local tests): kept in the Worker's KV and served from /files/<key>.png (or .jpg).
//
// A painting is stored once: the key is a hash of the painting, so ordering it again
// finds the file already there.

import { HttpError } from './util.js';

const KV_FILE_TTL = 60 * 60 * 24 * 120;

export function usesGithub(env) {
  return Boolean(env.GITHUB_REPO && env.GITHUB_TOKEN);
}

function toBase64(bytes) {
  let s = '';
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) s += String.fromCharCode.apply(null, bytes.subarray(i, i + step));
  return btoa(s);
}

// ext: 'png' or 'jpg', as readImage found it
export async function stageFile(env, key, bytes, workerOrigin, ext = 'png') {
  if (usesGithub(env)) {
    const branch = env.GITHUB_BRANCH || 'main';
    const path = `${(env.GITHUB_DIR || 'prints').replace(/^\/|\/$/g, '')}/${key}.${ext}`;
    const res = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/contents/${path}`, {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${env.GITHUB_TOKEN}`,
        accept: 'application/vnd.github+json',
        'user-agent': 'still-life-code-worker',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ message: `print file ${key}`, content: toBase64(bytes), branch }),
    });
    // 422: the file is already there (the same painting ordered before), which is fine
    if (!res.ok && res.status !== 422) {
      throw new HttpError(502, 'github_upload_failed', { github_status: res.status });
    }
    return `https://raw.githubusercontent.com/${env.GITHUB_REPO}/${branch}/${path}`;
  }

  await env.TOKENS.put(`file:${key}.${ext}`, bytes, { expirationTtl: KV_FILE_TTL });
  return `${workerOrigin}/files/${key}.${ext}`;
}

export async function readStagedFile(env, key, ext) {
  return env.TOKENS.get(`file:${key}.${ext}`, 'arrayBuffer');
}
