const express = require("express");
const fs = require("fs");
const path = require("path");
const os = require("os");
require('dotenv').config();

const app = express();
const SERIES_MAP_FILE = path.join(__dirname, "series_map.json");

// Función para cargar variables de entorno con manejo de errores.
function cargarVariableDeEntorno(nombre, valorPorDefecto) {
  if (!process.env[nombre]) { 
    if (valorPorDefecto !== undefined) {
      console.warn(`[WARN] La variable de entorno ${nombre} no está definida. Se usará el valor por defecto: ${valorPorDefecto}.`);
      return valorPorDefecto;
    }
    else {
      console.error("[ERROR] Debes definir la variable PORT archivo de variables de entorno '.env'.");
      process.exit(1);
    }
  }
  else {
    return process.env[nombre];
  }
}

// Cargamos variables de entorno
const CONTENT_DIR = cargarVariableDeEntorno("CONTENT_DIR");
const PORT = cargarVariableDeEntorno("PORT");

// Obtener IP LAN automáticamente
function getLocalIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === "IPv4" && !net.internal) return net.address;
    }
  }
  return "127.0.0.1";
}
const localIP = getLocalIP();

// Cargar SERIES_MAP
let SERIES_MAP = {};
try {
  if (fs.existsSync(SERIES_MAP_FILE)) {
    SERIES_MAP = JSON.parse(fs.readFileSync(SERIES_MAP_FILE, "utf8"));
    console.log(`[INFO] Cargado ${Object.keys(SERIES_MAP).length} IDs de ${SERIES_MAP_FILE}`);
  } else {
    console.warn(`[WARN] No existe ${SERIES_MAP_FILE}. Debes generarlo con FileBot.`);
  }
} catch (err) {
  console.error(`[ERROR] Falló la carga de ${SERIES_MAP_FILE}: ${err}`);
  SERIES_MAP = {};
}

// Buscar episodios por carpeta
function findEpisodes(folder) {
  const showPath = path.join(CONTENT_DIR, folder);
  if (!fs.existsSync(showPath)) return [];

  const episodes = [];
  const seasonDirs = fs.readdirSync(showPath).filter(d => d.toLowerCase().startsWith("season"));

  seasonDirs.forEach(seasonFolder => {
    const seasonPath = path.join(showPath, seasonFolder);
    const files = fs.readdirSync(seasonPath);

    files
      .filter(f => f.endsWith(".mp4") || f.endsWith(".mkv"))
      .forEach(f => {
        const match = f.match(/S(\d+)E(\d+)/i);
        if (!match) return;
        episodes.push({
          season: parseInt(match[1]),
          episode: parseInt(match[2]),
          file: f,
          path: path.join(seasonPath, f)
        });
      });
  });

  return episodes;
}

// Middleware CORS y preflight
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

// Middleware logs
app.use((req, res, next) => {
  console.log(`[REQUEST] ${req.method} ${req.url}`);
  next();
});

// Manifest mínimo para Stremio
const manifest = {
  id: "org.localaddon.series",
  version: "1.0.0",
  name: "Local Series Addon",
  description: "Sirve episodios locales con integración en Stremio usando archivos locales",
  resources: ["stream"],
  types: ["series"],
  idPrefixes: ["tt"],
  behaviorHints: {
    configurable: false,
    configurationRequired: false
  }
};

app.get("/manifest.json", (req, res) => {
  console.log("[INFO] Se solicitó el manifest");
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(manifest));
});

// Endpoint de streams
app.get("/stream/:type/:id.json", (req, res) => {
  const { type, id } = req.params;
  console.log(`[INFO] Request de stream para ${type} con id: ${id}`);

  let streams = [];

  if (type === "series") {
    const parts = id.split(":"); // ttID:season:episode
    const imdbId = parts[0];
    const season = parseInt(parts[1]);
    const episode = parseInt(parts[2]);

    const folder = Object.keys(SERIES_MAP).find(f => SERIES_MAP[f] === imdbId);
    if (!folder) {
      console.warn(`[WARN] IMDb ID ${imdbId} no encontrado en series_map.json`);
    } else {
      const episodes = findEpisodes(folder);
      const ep = episodes.find(e => e.season === season && e.episode === episode);
      if (ep) {
        const ipToUse = req.hostname === "localhost" || req.hostname === "127.0.0.1" ? "127.0.0.1" : localIP;
        streams.push({
          name: "Local",
          title: `${folder} - S${season}E${episode}`,
          url: `http://${ipToUse}:${PORT}/file/${encodeURIComponent(ep.path)}`
        });
        console.log(`[INFO] Episodio encontrado: ${ep.file}`);
      } else {
        console.warn(`[WARN] No se encontró el episodio S${season}E${episode} en la carpeta "${folder}"`);
      }
    }
  }

  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ streams }));
});

// Endpoint de archivos con soporte de chunks
app.get("/file/:filePath", (req, res) => {
  const filePath = decodeURIComponent(req.params.filePath);
  if (!fs.existsSync(filePath)) return res.status(404).send("Archivo no encontrado");

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = end - start + 1;

    const file = fs.createReadStream(filePath, { start, end });
    const head = {
      "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      "Accept-Ranges": "bytes",
      "Content-Length": chunkSize,
      "Content-Type": filePath.endsWith(".mkv") ? "video/x-matroska" : "video/mp4"
    };
    res.writeHead(206, head);
    file.pipe(res);
  } else {
    const head = {
      "Content-Length": fileSize,
      "Content-Type": filePath.endsWith(".mkv") ? "video/x-matroska" : "video/mp4"
    };
    res.writeHead(200, head);
    fs.createReadStream(filePath).pipe(res);
  }
});

// Iniciar servidor en todas las interfaces
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Addon corriendo en http://localhost:${PORT}/manifest.json`);
  console.log(`IP LAN accesible: http://${localIP}:${PORT}/manifest.json`);
});
