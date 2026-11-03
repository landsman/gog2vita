import { closeSync, openSync, readSync, writeSync } from "node:fs";
import { crc32 } from "node:zlib";

/**
 * Write the zip deterministic-zip 2.1.0 writes on Windows with `-r --compression-method store`,
 * byte for byte, and return its size. An xdelta patch made from that zip applies only to the
 * same bytes, and the tool itself writes other bytes elsewhere: `/` for `\`, its own sort
 * order, the host's file modes. Each name is a Windows path, the list sorted the way the tool
 * sorts it (see windowsOrder). The layout is Go's archive/zip writer, which the tool wraps.
 */
export function writeWindowsZip(files: ZipFile[], out: string): number {
  const fd = openSync(out, "w");
  const buffer = Buffer.alloc(4 << 20);
  const central: Buffer[] = [];
  let offset = 0;
  const put = (bytes: Uint8Array) => {
    writeSync(fd, bytes);
    offset += bytes.length;
  };
  try {
    for (const file of files) {
      const name = Buffer.from(file.name, "utf8");
      const start = offset;
      // data descriptor, and the UTF-8 flag Go sets on every name holding a backslash
      const flags = 0x8 | (needsUtf8Flag(file.name) ? 0x800 : 0);

      const local = Buffer.alloc(30);
      local.writeUInt32LE(0x04034b50, 0);
      local.writeUInt16LE(20, 4);
      local.writeUInt16LE(flags, 6);
      local.writeUInt16LE(DOS_DATE, 12);
      local.writeUInt16LE(name.length, 26);
      local.writeUInt16LE(EXT_TIME.length, 28);
      put(local);
      put(name);
      put(EXT_TIME);

      let crc = 0;
      let size = 0;
      const input = openSync(file.path, "r");
      try {
        for (let read; (read = readSync(input, buffer)) > 0; size += read) {
          const chunk = buffer.subarray(0, read);
          crc = crc32(chunk, crc);
          put(chunk);
        }
      } finally {
        closeSync(input);
      }

      const big = size >= MAX32;
      const descriptor = Buffer.alloc(big ? 24 : 16);
      descriptor.writeUInt32LE(0x08074b50, 0);
      descriptor.writeUInt32LE(crc, 4);
      if (big) {
        descriptor.writeBigUInt64LE(BigInt(size), 8);
        descriptor.writeBigUInt64LE(BigInt(size), 16);
      } else {
        descriptor.writeUInt32LE(size, 8);
        descriptor.writeUInt32LE(size, 12);
      }
      put(descriptor);

      const zip64 = big || start >= MAX32;
      const extra = zip64 ? Buffer.concat([EXT_TIME, zip64Extra(size, start)]) : EXT_TIME;
      const entry = Buffer.alloc(46);
      entry.writeUInt32LE(0x02014b50, 0);
      entry.writeUInt16LE(0x0314, 4); // made by Unix, version 2.0: Go's FileInfoHeader
      entry.writeUInt16LE(big ? 45 : 20, 6);
      entry.writeUInt16LE(flags, 8);
      entry.writeUInt16LE(DOS_DATE, 14);
      entry.writeUInt32LE(crc, 16);
      entry.writeUInt32LE(zip64 ? MAX32 : size, 20);
      entry.writeUInt32LE(zip64 ? MAX32 : size, 24);
      entry.writeUInt16LE(name.length, 28);
      entry.writeUInt16LE(extra.length, 30);
      entry.writeUInt32LE(WINDOWS_FILE_MODE, 38);
      entry.writeUInt32LE(start > MAX32 ? MAX32 : start, 42);
      central.push(entry, name, extra);
    }

    const directoryStart = offset;
    for (const part of central) put(part);
    const directorySize = offset - directoryStart;
    const records = files.length;
    const zip64End = records >= 0xffff || directorySize >= MAX32 || directoryStart >= MAX32;
    if (zip64End) {
      const end64 = Buffer.alloc(76);
      end64.writeUInt32LE(0x06064b50, 0);
      end64.writeBigUInt64LE(44n, 4);
      end64.writeUInt16LE(45, 12);
      end64.writeUInt16LE(45, 14);
      end64.writeBigUInt64LE(BigInt(records), 24);
      end64.writeBigUInt64LE(BigInt(records), 32);
      end64.writeBigUInt64LE(BigInt(directorySize), 40);
      end64.writeBigUInt64LE(BigInt(directoryStart), 48);
      end64.writeUInt32LE(0x07064b50, 56);
      end64.writeBigUInt64LE(BigInt(offset), 64);
      end64.writeUInt32LE(1, 72);
      put(end64);
    }
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(zip64End ? 0xffff : records, 8);
    end.writeUInt16LE(zip64End ? 0xffff : records, 10);
    end.writeUInt32LE(zip64End ? MAX32 : directorySize, 12);
    end.writeUInt32LE(zip64End ? MAX32 : directoryStart, 16);
    put(end);
    return offset;
  } finally {
    closeSync(fd);
  }
}

export interface ZipFile {
  /** The entry's name, a Windows path: `Hollow Knight\hollow_knight_Data\app.info`. */
  name: string;
  path: string;
}

/** Go's sort.Strings, the order the tool adds files in: by UTF-8 bytes, not UTF-16 units. */
export function windowsOrder(a: ZipFile, b: ZipFile): number {
  return Buffer.compare(Buffer.from(a.name, "utf8"), Buffer.from(b.name, "utf8"));
}

const MAX32 = 0xffffffff;
// the tool stamps every entry 2018-11-01 00:00 UTC, as an MS-DOS date and an extended timestamp
const DOS_DATE = 1 + (11 << 5) + ((2018 - 1980) << 9);
const EXT_TIME = (() => {
  const extra = Buffer.alloc(9);
  extra.writeUInt16LE(0x5455, 0);
  extra.writeUInt16LE(5, 2);
  extra.writeUInt8(1, 4);
  extra.writeUInt32LE(Date.UTC(2018, 10, 1) / 1000, 5);
  return extra;
})();
// Go reports a writable file on Windows as 0666, stored as a Unix regular file
const WINDOWS_FILE_MODE = 0o100666 * 0x10000;

function zip64Extra(size: number, offset: number): Buffer {
  const extra = Buffer.alloc(28);
  extra.writeUInt16LE(0x0001, 0);
  extra.writeUInt16LE(24, 2);
  extra.writeBigUInt64LE(BigInt(size), 4);
  extra.writeBigUInt64LE(BigInt(size), 12);
  extra.writeBigUInt64LE(BigInt(offset), 20);
  return extra;
}

/** Go's detectUTF8: anything outside 0x20-0x7d, and the backslash, which Shift-JIS reads as yen. */
function needsUtf8Flag(name: string): boolean {
  return /[^\x20-\x5b\x5d-\x7d]/u.test(name);
}
