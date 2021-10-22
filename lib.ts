import { BufReader, BufWriter, readLines } from "./deps.ts";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const newline = new Uint8Array(1);
newline[0] = 10;

async function read_string(reader: BufReader): Promise<string | null> {
  let line = await reader.readString("\n");
  if (line) {
    return line.trim();
  }
  return null;
}

async function read_bytes(reader: BufReader): Promise<Uint8Array | null> {
  let size_str = await read_string(reader);
  if (!size_str) {
    return null;
  }
  let size = parseInt(size_str);
  let buf = new Uint8Array(size);
  let bytes = await reader.read(buf);
  return buf;
}

async function read_headers(reader: BufReader) { //}: Promise<Headers | null> {
  let bytes = await read_bytes(reader);
  let res = new Map();
  if (bytes && bytes.length > 0) {
    let lines = readLines(new Deno.Buffer(bytes))
    for await (const line of lines) {
      let parts = line.split(":");
      res.set(parts[0], parts[1])
    }
  }
  return res
}

async function write_line(w: BufWriter, d: string) {
  await w.write(encoder.encode(d));
  await w.write(newline);
}

async function write_bytes(w: BufWriter, d: Uint8Array) {
  await write_line(w, "" + d.length);
  await w.write(d);
}

async function write_headers(w: BufWriter, d: Map<string, string>) {
  let data = "";
  for (let [k, v] of d) {
    data += `${k}:${v}\n`
  }
  let enc = encoder.encode(data);
  await write_line(w, "" + enc.length);
  await w.write(enc);
}

class Message {
  key: Uint8Array;
  headers: Map<string, string>;
  body: Uint8Array;
  constructor(
    key: Uint8Array,
    headers: Map<string, string>,
    body: Uint8Array,
  ) {
    this.key = key;
    this.headers = headers;
    this.body = body;
  }
}

export async function each(cb: (msg: Message) => Message) {
  let reader = new BufReader(Deno.stdin);
  let writer = new BufWriter(Deno.stdout);
  let err_writer = new BufWriter(Deno.stderr);
  while (true) {
    let version = await read_string(reader);
    if (!version) { // No more data to read
      return;
    }
    let key = await read_bytes(reader);
    if (!key) {
      return;
    }
    let tag = await read_string(reader);
    if (!tag) {
      return;
    }
    let headers = await read_headers(reader);
    if (!headers) {
      return;
    }
    let body = await read_bytes(reader);
    if (!body) {
      return;
    }

    let res;
    try {
      res = cb(new Message(key, headers, body));
    } catch (e) {
      console.error("[ERROR]", e.message);
      return;
    }

    await write_line(writer, version);
    await write_bytes(writer, res.key);
    await write_line(writer, tag);
    await write_headers(writer, res.headers);
    await write_bytes(writer, res.body);
    await writer.flush();
  }
}

export function to_json(body: Uint8Array) {
  return JSON.parse(to_string(body));
}

export function to_string(body: Uint8Array) {
  return decoder.decode(body);
}

export function to_byte_array(value: string) {
  return encoder.encode(value);
}
