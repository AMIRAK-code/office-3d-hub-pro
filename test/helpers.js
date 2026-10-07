import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { io as connectSocket } from 'socket.io-client';
import { createApp } from '../server/app.js';

export function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'office-hub-test-'));
}

/** Start a server on a random port. Returns helpers bound to it. */
export async function startServer(options) {
  const dataDir = options.dataDir || tempDir();
  const instance = createApp({ env: {}, ...options, dataDir });
  await new Promise((r) => instance.server.listen(0, '127.0.0.1', r));
  const { port } = instance.server.address();
  const base = `http://127.0.0.1:${port}`;
  const sockets = [];

  const api = async (method, url, { body, token, headers = {} } = {}) => {
    const res = await fetch(base + url, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* html */
    }
    return { status: res.status, json, text };
  };

  /** GET with a custom Host header (fetch forbids setting Host). */
  const getWithHost = (url, host) => new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: url, headers: { Host: host } }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ status: res.statusCode, text: data }));
    });
    req.on('error', reject);
    req.end();
  });

  /** Connect a socket to a workspace namespace; resolves with { socket, init } or rejects with the error. */
  const socket = (slug, token) => new Promise((resolve, reject) => {
    const s = connectSocket(`${base}/ws/${slug}`, { auth: { token }, transports: ['websocket'], reconnection: false, forceNew: true });
    sockets.push(s);
    s.once('init', (init) => resolve({ socket: s, init }));
    s.once('connect_error', (err) => reject(err));
  });

  const act = (s, type, payload) => new Promise((resolve) => s.emit('act', type, payload, resolve));

  const close = async () => {
    for (const s of sockets) s.close();
    instance.registry.flushAll();
    await new Promise((r) => instance.server.close(r));
    instance.io.close();
  };

  return { ...instance, base, dataDir, api, getWithHost, socket, act, close };
}

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));
