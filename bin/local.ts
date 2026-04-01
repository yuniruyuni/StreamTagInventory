const server = Bun.serve({
  port: process.env.PORT != null ? Number(process.env.PORT) : 3000,
  fetch: async (req) => {
    let path = new URL(req.url).pathname;
    if (path === "/") path = "/index.html";
    // Remove leading slash to avoid double slashes
    const filePath = path.startsWith("/") ? path.slice(1) : path;
    const file = Bun.file(`static/${filePath}`);
    return new Response(file);
  },
});
console.log(`Listening on http://localhost:${server.port}`);
