// Gzip 压缩/解压（D1 BLOB 存储），Workers 环境原生支持 CompressionStream

export const compressText = async (text: string): Promise<ArrayBuffer> => {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Response(stream).arrayBuffer();
};

export const decompressBlob = async (buffer: ArrayBuffer): Promise<string> => {
  const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Response(stream).text();
};

/** 解析一行 raw_mails：若有 raw_blob 则解压，并从结果中移除 raw_blob 字段 */
export const resolveRawEmailRow = async <T extends { raw_blob?: any; raw?: string | null }>(
  row: T
): Promise<Omit<T, "raw_blob">> => {
  const { raw_blob: _raw_blob, ...rest } = row;
  let raw = row.raw ?? "";
  if (row.raw_blob) {
    try {
      const data =
        row.raw_blob instanceof ArrayBuffer
          ? row.raw_blob
          : new Uint8Array(row.raw_blob as ArrayLike<number>).buffer;
      raw = await decompressBlob(data);
    } catch (e) {
      console.error("decompressBlob failed, fallback to raw field", e);
      raw = row.raw ?? "";
    }
  }
  return { ...rest, raw };
};

export const resolveRawEmailList = async <T extends { raw_blob?: any; raw?: string | null }>(
  rows: T[]
): Promise<Array<Omit<T, "raw_blob">>> => {
  return Promise.all(rows.map(resolveRawEmailRow));
};