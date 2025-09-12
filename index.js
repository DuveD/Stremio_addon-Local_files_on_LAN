// Módulos nativos
const fs = require("fs");
const path = require("path");
const os = require("os");

// Módulos de terceros
require("dotenv").config();
const express = require("express");
const ffmpeg = require("fluent-ffmpeg");
ffmpeg.setFfprobePath("ffprobe");

// Módulos locales
const utilidadesLog = require("./UtilidadesLog.js").default;

const app = express();
const SERIES_MAP_FILE = path.join(__dirname, "series_map.json");

// Función para cargar variables de entorno con manejo de errores.
function cargarVariableDeEntorno(nombre, valorPorDefecto) {
	if (!process.env[nombre]) {
		if (valorPorDefecto !== undefined) {
			utilidadesLog.logWarn(
				`La variable de entorno ${nombre} no está definida. Se usará el valor por defecto: ${valorPorDefecto}.`
			);
			return valorPorDefecto;
		} else {
			utilidadesLog.logError(
				`Debes definir la variable PORT archivo de variables de entorno '.env'.`
			);
			process.exit(1);
		}
	} else {
		return process.env[nombre];
	}
}

// Cargamos variables de entorno
const CONTENT_DIR = cargarVariableDeEntorno("CONTENT_DIR");
const PORT = cargarVariableDeEntorno("PORT");

// FUnción para obtener IP Local.
function obtenerIPLocal() {
	const nets = os.networkInterfaces();

	for (const name of Object.keys(nets)) {
		for (const net of nets[name]) {
			if (net.family === "IPv4" && !net.internal) return net.address;
		}
	}

	return "127.0.0.1";
}

const localIP = obtenerIPLocal();

function formatearTamano(bytes) {
	if (bytes === 0) return "0.00 B";

	const units = ["B", "KB", "MB", "GB", "TB", "PB"];
	const i = Math.floor(Math.log(bytes) / Math.log(1024));
	const size = bytes / Math.pow(1024, i);

	return size.toFixed(2) + " " + units[i];
}

function obtenerMetadatos(filePath) {
	return new Promise((resolve, reject) => {
		ffmpeg.ffprobe(filePath, (err, metadata) => {
			if (err) return reject(err);
			const stream = metadata.streams.find((s) => s.width && s.height);
			if (!stream)
				return resolve({ width: 0, height: 0, resolution: "Desconocida" });
			resolve({
				width: stream.width,
				height: stream.height,
				resolution: `${stream.width}x${stream.height}`,
			});
		});
	});
}

let SERIES_MAP = {};

// Función para cargar series_map.json
function loadSeriesMap() {
	try {
		if (fs.existsSync(SERIES_MAP_FILE)) {
			SERIES_MAP = JSON.parse(fs.readFileSync(SERIES_MAP_FILE, "utf8"));
			var nEntradas = Object.keys(SERIES_MAP).length;
			utilidadesLog.logInfo(`SERIES_MAP actualizado: ${nEntradas} entradas.`);
		} else {
			utilidadesLog.logWarn(`No existe ${SERIES_MAP_FILE}.`);
			SERIES_MAP = {};
		}
	} catch (err) {
		utilidadesLog.logError(`Falló la carga de ${SERIES_MAP_FILE}: ${err}`);
		SERIES_MAP = {};
	}
}

// Cargar una vez al inicio
loadSeriesMap();

// Buscar episodios por carpeta
function findEpisodes(folder) {
	const showPath = path.join(CONTENT_DIR, folder);
	if (!fs.existsSync(showPath)) return [];

	const episodes = [];
	const seasonDirs = fs
		.readdirSync(showPath)
		.filter((d) => d.toLowerCase().startsWith("season"));

	seasonDirs.forEach((seasonFolder) => {
		const seasonPath = path.join(showPath, seasonFolder);
		const files = fs.readdirSync(seasonPath);

		files
			.filter((f) => f.endsWith(".mp4") || f.endsWith(".mkv"))
			.forEach((f) => {
				const match = f.match(/S(\d+)E(\d+)/i);
				if (!match) return;
				episodes.push({
					season: parseInt(match[1]),
					episode: parseInt(match[2]),
					file: f,
					path: path.join(seasonPath, f),
				});
			});
	});

	return episodes;
}

// Middleware CORS y preflight
app.use((req, res, next) => {
	res.header("Access-Control-Allow-Origin", "*");
	res.header(
		"Access-Control-Allow-Headers",
		"Origin, X-Requested-With, Content-Type, Accept"
	);
	res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
	if (req.method === "OPTIONS") return res.sendStatus(200);
	next();
});

// Middleware logs
app.use((req, res, next) => {
	const formatedUrl = decodeURIComponent(req.url);
	utilidadesLog.logInfo(`[REQUEST] ${req.method} ${formatedUrl}`);
	next();
});

// Manifest mínimo para Stremio
const manifest = {
	id: "org.localaddon.series",
	version: "1.0.0",
	name: "Local",
	description: "Sirve episodios de series almacenados en local.",
	resources: ["stream"],
	types: ["series"],
	idPrefixes: ["tt"],
	behaviorHints: {
		configurable: false,
		configurationRequired: false,
	},
};

app.get("/manifest.json", (req, res) => {
	utilidadesLog.logInfo(`Se solicitó el manifest`);
	res.setHeader("Content-Type", "application/json");
	res.end(JSON.stringify(manifest));
});

// Endpoint de streams
app.get("/stream/:type/:id.json", async (req, res) => {
	const { type, id } = req.params;
	utilidadesLog.logInfo(
		`[REQUEST] Request de stream para ${type} con id: ${id}`
	);

	let streams = [];

	if (type === "series") {
		const [imdbId, seasonStr, episodeStr] = id.split(":");
		const season = parseInt(seasonStr);
		const episode = parseInt(episodeStr);

		const folder = Object.keys(SERIES_MAP).find(
			(f) => SERIES_MAP[f] === imdbId
		);
		if (!folder) {
			utilidadesLog.logWarn(
				`[REQUEST] IMDb ID ${imdbId} no encontrado. Intentando recargar series_map.json...`
			);
			loadSeriesMap();
			folder = Object.keys(SERIES_MAP).find((f) => SERIES_MAP[f] === imdbId);
		}

		if (!folder) {
			utilidadesLog.logWarn(
				`[REQUEST] IMDb ID ${imdbId} no encontrado en series_map.json`
			);
			return res
				.status(404)
				.json({ error: `IMDb ID ${imdbId} no encontrado en series_map.json.`});
		} else {
			const episodes = findEpisodes(folder);
			const ep = episodes.find(
				(e) => e.season === season && e.episode === episode
			);
			if (ep) {
				try {
					const stat = fs.statSync(ep.path);
					const tamano = formatearTamano(stat.size);
					const metadatos = await obtenerMetadatos(ep.path);
					const resolucion = `${metadatos.height}p`;

					streams.push({
						name: "Local",
						title: `${folder} S${String(season).padStart(2, "0")}E${String(
							episode
						).padStart(2, "0")} ${resolucion}\n💾 ${tamano}`,
						url: `http://${localIP}:${PORT}/file/${encodeURIComponent(
							ep.path
						)}`,
					});

					utilidadesLog.logInfo(
						`[REQUEST] Episodio encontrado: ${ep.file} (${resolucion}, ${tamano})`
					);
				} catch (err) {
					utilidadesLog.logError(
						`[REQUEST] No ha podido procesar el archivo ${ep.file}: ${err}`
					);
					return res
						.status(404)
						.json({ error: `No se pudo procesar el archivo ${ep.file}.`});
				}
			} else {
				utilidadesLog.logWarn(
					`[REQUEST] No se encontró el episodio S${season}E${episode} en la carpeta "${folder}"`
				);
				return res.status(404).json({
					error: `Episodio S${season}E${episode} no encontrado en el servidor.`,
				});
			}
		}
	}

	res.setHeader("Content-Type", "application/json");
	res.end(JSON.stringify({ streams }));
});

// Endpoint de archivos con soporte de chunks
app.get("/file/:filePath", (req, res) => {
	const filePath = decodeURIComponent(req.params.filePath);
	if (!fs.existsSync(filePath))
		return res.status(404).send("Archivo no encontrado.");

	const stat = fs.statSync(filePath);
	const fileSize = stat.size;
	const range = req.headers.range;

	if (range) {
		const parts = range.replace(/bytes=/, "").split("-");
		const start = parseInt(parts[0], 10);
		const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
		const chunkSize = end - start + 1;
		const fileName = path.basename(filePath);

		utilidadesLog.logInfo(
			`[REQUEST-RANGE] ${fileName} -> ${start}-${end} / ${fileSize} (${chunkSize} bytes)`
		);

		const file = fs.createReadStream(filePath, { start, end });
		const head = {
			"Content-Range": `bytes ${start}-${end}/${fileSize}`,
			"Accept-Ranges": "bytes",
			"Content-Length": chunkSize,
			"Content-Type": filePath.endsWith(".mkv")
				? "video/x-matroska"
				: "video/mp4",
		};
		res.writeHead(206, head);

		file.pipe(res);

		// Log cuando termina o se corta el stream
		req.on("close", () => {
			utilidadesLog.logInfo(
				`[REQUEST-CLOSE] Cliente canceló chunk en ${path.basename(
					filePath
				)} (${start}-${end})`
			);
		});

		// Log al etectar cancelaci��n (ej. si el usuario salta en la reproducci��n)
		req.on("aborted", () => {
			utilidadesLog.logInfo(
				`[REQUEST-ABORTED] Cliente canceló chunk en ${path.basename(
					filePath
				)} (${start}-${end})`
			);
			file.destroy();
		});
	} else {
		utilidadesLog.logInfo(
			`[REQUEST-FULL] Sirviendo archivo completo: ${path.basename(
				filePath
			)} (${fileSize} bytes)`
		);

		const head = {
			"Content-Length": fileSize,
			"Content-Type": filePath.endsWith(".mkv")
				? "video/x-matroska"
				: "video/mp4",
		};
		res.writeHead(200, head);
		fs.createReadStream(filePath).pipe(res);
	}
});

// Iniciar servidor en todas las interfaces
app.listen(PORT, "0.0.0.0", () => {
	utilidadesLog.logInfo(
		`Addon corriendo en http://localhost:${PORT}/manifest.json`
	);
	utilidadesLog.logInfo(
		`IP LAN accesible: http://${localIP}:${PORT}/manifest.json`
	);
});
