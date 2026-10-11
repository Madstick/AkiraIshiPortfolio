// Small things the Worker's modules share.

// An error that carries the HTTP status and a short code for the visitor, and detail for the logs.
export class HttpError extends Error {
  constructor(status, code, detail) {
    super(code);
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

function base64url(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function randomToken(byteLength = 32) {
  return base64url(crypto.getRandomValues(new Uint8Array(byteLength)));
}
