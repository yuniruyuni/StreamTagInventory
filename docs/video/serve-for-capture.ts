// Serve the e2e build on port 3100 for screenshot capture
Bun.serve({
  port: 3100,
  fetch: async (req) => {
    let path = new URL(req.url).pathname;
    if (path === "/") path = "/index.html";
    const filePath = path.startsWith("/") ? path.slice(1) : path;
    const root = import.meta.dir + "/../../../static";
    const file = Bun.file(`${root}/${filePath}`);
    return new Response(file);
  },
});
