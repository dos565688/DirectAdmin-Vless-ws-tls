process.on("uncaughtException", () => {});
process.on("unhandledRejection", () => {});

const UUID   = (process.env.UUID   || "0cbbd5b1-2ba6-405f-b71d-03c92cb7b6e8").trim();
const DOMAIN = (process.env.DOMAIN || "your-domain.example.com").trim();
const NAME   = "DirectAdmin-eishare";
const PORT   = 0;

const http = require("http");
const net  = require("net");
const { WebSocket, createWebSocketStream } = require("ws");

const BEST = ["www.visa.cn", "usa.visa.com", "time.is", "www.wto.org"];
const uuidBytes = UUID.replace(/-/g, "");

function gen(addr) {
  return `vless://${UUID}@${addr}:443?encryption=none&security=tls&sni=${DOMAIN}&fp=chrome&type=ws&host=${DOMAIN}&path=%2F#${NAME}`;
}

const server = http.createServer((req, res) => {
  if (req.url === "/") return res.end("VLESS WS TLS\n");
  if (req.url === `/${UUID}`) {
    return res.end(BEST.map(d => gen(d)).join("\n\n") + "\n");
  }
  res.statusCode = 404;
  res.end("404");
});

const wss = new WebSocket.Server({ server });

wss.on("connection", ws => {
  // 轻量保活（每 60 秒一次，不频繁唤醒 CPU）
  ws.isAlive = true;
  ws.on("pong", () => ws.isAlive = true);

  const timer = setInterval(() => {
    if (!ws.isAlive) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  }, 60000);

  ws.on("close", () => clearInterval(timer));

  ws.once("message", msg => {
    const id = msg.slice(1,17);
    if (!id.every((v,i)=> v===parseInt(uuidBytes.substr(i*2,2),16))) return;

    let p = msg[17] + 19;

    const port = msg.readUInt16BE(p); 
    p += 2;

    const atyp = msg[p++];
    if (atyp !== 1) return ws.close();

    const host = `${msg[p++]}.${msg[p++]}.${msg[p++]}.${msg[p++]}`;

    ws.send(new Uint8Array([msg[0],0]));

    const duplex = createWebSocketStream(ws);
    net.connect({ host, port }, function() {
      this.write(msg.slice(p));
      duplex.pipe(this).pipe(duplex);
    }).on("error", () => ws.close());
  });
});

server.listen(PORT, "0.0.0.0", () => {
  BEST.forEach(d => console.log(gen(d)));
  console.log("\n访问 /" + UUID + " 获取全部节点\n");
});
