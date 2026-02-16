import { HTTPException } from "hono/http-exception";

export const throwErr = (c:any, msg:any, statusCode?: number) => {
  let type = typeof msg;
  console.error(msg);
  return c.json(
    {
      success: false,
      msg,
      //   type,
    },
    statusCode ?? 500
  );
};

export const handleError = (err:any, c:any) => {
  let type = typeof err;
  let error = `${err}`;
  if (err instanceof HTTPException) return err.getResponse();
  console.error(error);
  return c.json(
    {
      success: false,
      msg: error,
      //   type,
    },
    500
  );
};
export const res = (c:any, obj?:any) => {
  const acceptEncoding = c.req.header('accept-encoding');
  c.header('Content-Type', 'application/json');
  const str = JSON.stringify({ success: true, ...obj });
  if (str.length <= 50) return c.json({ success: true, ...obj });

  if (obj && acceptEncoding && acceptEncoding.includes('zstd')) {
    const data = Buffer.from(str);
    const compressed = Bun.zstdCompressSync(data);
    c.header('Content-Encoding', 'zstd');
    return c.body(compressed);
  }

  if (obj && acceptEncoding && acceptEncoding.includes('gzip')) {
    const data = Buffer.from(str);
    const compressed = Bun.gzipSync(data);
    c.header('Content-Encoding', 'gzip');
    return c.body(compressed);
  }

  if (obj) return c.json({ success: true, ...obj });
  return c.json({ success: true });
};
