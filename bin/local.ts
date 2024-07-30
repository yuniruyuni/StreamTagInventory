Bun.serve({
  port: 3000,
  fetch: async(req) => {
    let path = new URL(req.url).pathname;
    if( path === "/" ) path = "index.html";
    const file = Bun.file(`static/${path}`);
    return new Response(file);
  },
})