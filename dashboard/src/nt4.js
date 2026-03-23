import { decode, encode } from '@msgpack/msgpack';

// NT4 wire type IDs (used in binary publish frames)
const TYPE_IDS = {
  boolean: 0, double: 1, int: 2, float: 3,
  string: 4, raw: 5,
  'boolean[]': 16, 'double[]': 17, 'int[]': 18,
  'float[]': 19, 'string[]': 20,
};

export class NT4 {
  constructor(url) {
    this._url      = url;
    this._topics   = new Map();   // id  → { name, type }
    this._byName   = new Map();   // name → id
    this._values   = new Map();   // name → latest value
    this._subs     = new Map();   // name → Set<callback>
    this._pubs     = new Map();   // name → pubuid
    this._subuid   = 0;
    this._pubuid   = 0;
    this.connected = false;
    this._onConn   = new Set();
    this._onDisc   = new Set();
    this._connect();
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  _connect() {
    this._ws = new WebSocket(this._url);
    this._ws.binaryType = 'arraybuffer';

    this._ws.onopen = () => {
      this.connected = true;
      // Subscribe to the entire topic tree with prefix "/"
      this._send([{
        method: 'subscribe',
        params: {
          topics:  [{ name: '/' }],
          subuid:  ++this._subuid,
          options: { immediate: true, periodic: 0.05, prefix: true },
        },
      }]);
      this._onConn.forEach(f => f());
    };

    this._ws.onmessage = ({ data }) => {
      if (typeof data === 'string') {
        this._handleText(data);
      } else {
        this._handleBinary(data);
      }
    };

    this._ws.onclose = () => {
      this.connected = false;
      this._onDisc.forEach(f => f());
      setTimeout(() => this._connect(), 2000);
    };

    this._ws.onerror = () => { /* onclose handles retry */ };
  }

  _send(messages) {
    if (this._ws.readyState === WebSocket.OPEN)
      this._ws.send(JSON.stringify(messages));
  }

  _handleText(raw) {
    let msgs;
    try { msgs = JSON.parse(raw); } catch { return; }
    for (const m of msgs) {
      if (m.method === 'announce') {
        const { id, name, type } = m.params;
        this._topics.set(id, { name, type });
        this._byName.set(name, id);
        // Fire existing value immediately if already cached
        if (this._values.has(name))
          this._subs.get(name)?.forEach(f => f(this._values.get(name)));
      } else if (m.method === 'unannounce') {
        this._topics.delete(m.params.id);
        this._byName.delete(m.params.name);
      }
    }
  }

  _handleBinary(buffer) {
    // NT4 binary frame: MessagePack [topicId, timestamp_us, typeId, value]
    let frame;
    try { frame = decode(new Uint8Array(buffer)); } catch { return; }
    if (!Array.isArray(frame) || frame.length < 4) return;

    const [topicId, , , rawVal] = frame;
    const topic = this._topics.get(topicId);
    if (!topic) return;

    // Coerce BigInt (msgpack int64) to Number for display purposes
    const value = typeof rawVal === 'bigint' ? Number(rawVal) : rawVal;
    this._values.set(topic.name, value);
    this._subs.get(topic.name)?.forEach(f => f(value));
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /** Subscribe to a topic. Callback fires immediately if value is already known.
   *  Returns an unsubscribe function. */
  on(name, callback) {
    if (!this._subs.has(name)) this._subs.set(name, new Set());
    this._subs.get(name).add(callback);
    if (this._values.has(name)) callback(this._values.get(name));
    return () => this._subs.get(name)?.delete(callback);
  }

  /** Get the latest value for a topic, or `def` if not yet received. */
  get(name, def = null) {
    return this._values.has(name) ? this._values.get(name) : def;
  }

  /** Publish a value to a topic. Announces on first call, then sends data. */
  publish(name, typeStr, value) {
    if (!this._pubs.has(name)) {
      const uid = ++this._pubuid;
      this._pubs.set(name, uid);
      this._send([{
        method: 'publish',
        params: { name, pubuid: uid, type: typeStr, properties: {} },
      }]);
    }
    const uid    = this._pubs.get(name);
    const typeId = TYPE_IDS[typeStr] ?? TYPE_IDS.string;
    const ts     = Math.floor(performance.now() * 1000); // µs
    if (this._ws.readyState === WebSocket.OPEN)
      this._ws.send(encode([uid, ts, typeId, value]));
  }

  onConnect(fn)    { this._onConn.add(fn); if (this.connected) fn(); }
  onDisconnect(fn) { this._onDisc.add(fn); }
}
