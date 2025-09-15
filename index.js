
// Módulos nativos
const fs = require("fs");
const path = require("path");

// Módulos de terceros
require("dotenv").config();
const express = require("express");
const { StatusCodes, getReasonPhrase } = require('http-status-codes');

// Módulos locales
const utilidadesArchivo = 	require("./utilidades/UtilidadesArchivo.js");
const utilidadesEntorno = 	require("./utilidades/UtilidadesEntorno.js");
const utilidadesLog = 		require("./utilidades/UtilidadesLog.js");
const utilidadesRed = 		require("./utilidades/UtilidadesRed.js");
const utilidadesString = 	require("./utilidades/UtilidadesString.js");

// Manifest mínimo para Stremio
const manifest = {
	id: "org.localAddon.localLanStreaming",
	version: "2.2.0",
	name: "Local LAN Streaming",
	description: "Addon para servir contenido almacenado en red local.",
	resources: ["stream"],
	types: ["series"],
	idPrefixes: ["tt"],
	behaviorHints: {
		configurable: false,
		configurationRequired: false,
	},
};

const app = express();

// Ruta al archivo series_map.json
const SERIES_MAP_FILE = path.join(__dirname, "series_map.json");

// Cargamos variables de entorno
const SERIES_DIR = utilidadesEntorno.cargarVariable("SERIES_DIR");
const PELICULAS_DIR = utilidadesEntorno.cargarVariable("PELICULAS_DIR");
const PORT = utilidadesEntorno.cargarVariable("PORT");
const FORMATO_NOMBRE_SIMPLIFICADO = utilidadesEntorno.cargarVariableBoolean("FORMATO_NOMBRE_SIMPLIFICADO", false);

const localIP = utilidadesRed.obtenerIPLocal();

let SERIES_MAP = {};

// Función para cargar series_map.json
function cargarMapaDeSeries() {
	try {
		if (fs.existsSync(SERIES_MAP_FILE)) {
			SERIES_MAP = JSON.parse(fs.readFileSync(SERIES_MAP_FILE, "utf8"));
			var nEntradas = Object.keys(SERIES_MAP).length;

			const mensajeInfoLog = utilidadesLog.formatInfoLog(`SERIES_MAP actualizado: ${nEntradas} entradas.`);
			console.log(mensajeInfoLog);
		} else {
			SERIES_MAP = {};

			const mensajeWarnLog = utilidadesLog.formatWarnLog(`No existe ${SERIES_MAP_FILE}.`);
			console.warn(mensajeWarnLog);
		}
	} catch (err) {
		SERIES_MAP = {};

		const mensajeErrorLog = utilidadesLog.formatErrorLog(`Falló la carga de ${SERIES_MAP_FILE}: ${err}`)
		console.error(mensajeErrorLog);
	}
}

// Cargar una vez al inicio
cargarMapaDeSeries();

// Buscar episodios por carpeta
function buscarEpisodios(folder) {
	const showPath = path.join(SERIES_DIR, folder);
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
	if (req.method === "OPTIONS") return res.sendStatus(StatusCodes.OK);
	next();
});

// Middleware logs
app.use((req, res, next) => {
	//const formatedUrl = decodeURIComponent(req.url);
	//const mensajeInfoLog = utilidadesLog.formatInfoLog(`(${req.method}) ${formatedUrl}`,`REQUEST`);
	//console.log(mensajeInfoLog);

	next();
});

app.get("/manifest.json", (req, res) => {
	const mensajeInfoLog = utilidadesLog.formatInfoLog(`Se solicitó el manifest`,`REQUEST`);
	console.log(mensajeInfoLog);

	res.setHeader("Content-Type", "application/json");
	res.end(JSON.stringify(manifest));
});

// Endpoint de streams
app.get("/stream/:type/:id.json", async (req, res) => {
	const { type, id } = req.params;

	if (!type || !id) {
        return res.status(StatusCodes.BAD_REQUEST).json({ error: "Parámetros inválidos." });
    }

	const mensajeInfoLog = utilidadesLog.formatInfoLog(
		`Request de stream para ${type} con id: ${id}`,`REQUEST`
	);
	console.log(mensajeInfoLog);

	let streams = [];

	if (type === "series") {
		const [imdbId, nTemporadaStr, nEpisodioStr] = id.split(":");
		const nTemporada = parseInt(nTemporadaStr);
		const nEpisodio = parseInt(nEpisodioStr);

		let nombreCarpetaSerie = Object.keys(SERIES_MAP).find(
			(f) => SERIES_MAP[f] === imdbId
		);
		
		if (!nombreCarpetaSerie) {

			const mensajeWarnLog = utilidadesLog.formatWarnLog(
				`IMDb ID ${imdbId} no encontrado. Intentando recargar series_map.json...`,`REQUEST`
			)
			console.warn(mensajeWarnLog);

			cargarMapaDeSeries();
			nombreCarpetaSerie = Object.keys(SERIES_MAP).find((f) => SERIES_MAP[f] === imdbId);
		}

		if (!nombreCarpetaSerie) {
			const mensajeWarnLog = utilidadesLog.formatWarnLog(
				`IMDb ID ${imdbId} no encontrado en series_map.json`,`REQUEST`
			);
			console.warn(mensajeWarnLog);

			return res
				.status(StatusCodes.NOT_FOUND)
				.json({ error: `IMDb ID ${imdbId} no encontrado en series_map.json.`});
		} else {
			const episodios = buscarEpisodios(nombreCarpetaSerie);
			const episodio = episodios.find(
				(e) => e.season === nTemporada && e.episode === nEpisodio
			);
			if (episodio) {
				try {
					const nombreEpisodio = await obtenerNombreEpisodio(episodio, nTemporada, nEpisodio, nombreCarpetaSerie);

					streams.push({
						name: "Local LAN Streaming",
						title: nombreEpisodio,
						url: `http://${localIP}:${PORT}/file/${encodeURIComponent(
							episodio.path
						)}`,
					});

					const mensajeInfoLog = utilidadesLog.formatInfoLog(
						`Episodio encontrado: ${episodio.file}`,`REQUEST`
					);
					console.log(mensajeInfoLog);
				} catch (err) {
					const mensajeErrorLog = utilidadesLog.formatErrorLog(
						`Error al obtener metadatos del archivo ${episodio.file}: ${err}`,`REQUEST`
					);	
					console.error(mensajeErrorLog);

					return res
						.status(StatusCodes.INTERNAL_SERVER_ERROR)
						.json({ error: `No se pudo procesar el archivo ${episodio.file}.`});
				}
			} else {
				const mensajeWarnLog = utilidadesLog.formatWarnLog(
					`Episodio S${nTemporada}E${nEpisodio} no encontrado en local.`,`REQUEST`
				);
				console.warn(mensajeWarnLog);

				return res.status(StatusCodes.NOT_FOUND).json({
					error: `Episodio S${nTemporada}E${nEpisodio} no encontrado en el servidor.`,
				});
			}
		}
	}
	else {
		return res.status(StatusCodes.BAD_REQUEST).json({ error: `Tipo ${type} no soportado.` });
	}

	res.setHeader("Content-Type", "application/json");
	res.end(JSON.stringify({ streams }));
});

// Endpoint de archivos con soporte de chunks
app.get("/file/:filePath", (req, res) => {
	const filePath = decodeURIComponent(req.params.filePath);
	const fileName = path.basename(filePath);

    // Seguridad: Solo permitir archivos dentro de SERIES_DIR o PELICULAS_DIR
	const absFilePath = path.resolve(filePath);
    const isInSeries = absFilePath.startsWith(path.resolve(SERIES_DIR) + path.sep);
    const isInPeliculas = absFilePath.startsWith(path.resolve(PELICULAS_DIR) + path.sep);

    if (!isInSeries && !isInPeliculas) {
		const mensajeWarnLog = utilidadesLog.formatWarnLog(
			`Intento de acceso a archivo fuera de las carpetas permitidas: ${filePath}`,`SECURITY`
		);
        console.warn(mensajeWarnLog);

        return res.status(StatusCodes.FORBIDDEN).send("Acceso denegado.");
    }

	if (!fs.existsSync(filePath))
		return res.status(StatusCodes.NOT_FOUND).send("Archivo no encontrado.");

	const stat = fs.statSync(filePath);
	const fileSize = stat.size;
	const range = req.headers.range;

	if (range) {
		const parts = range.replace(/bytes=/, "").split("-");
		const start = parseInt(parts[0], 10);
		const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
		const chunkSize = end - start + 1;
		const tamano = utilidadesArchivo.formatearTamano(chunkSize);

		const mensajeInfoLog = utilidadesLog.formatInfoLog(
			`El cliente ha solicitado un chunk (${fileName} [${start}-${end}]) (${tamano})`,`REQUEST(RANGE)`
		);
		console.log(mensajeInfoLog);

		const file = fs.createReadStream(filePath, { start, end });
		const head = {
			"Content-Range": `bytes ${start}-${end}/${fileSize}`,
			"Accept-Ranges": "bytes",
			"Content-Length": chunkSize,
			"Content-Type": filePath.endsWith(".mkv")
				? "video/x-matroska"
				: "video/mp4",
		};
		res.writeHead(StatusCodes.PARTIAL_CONTENT, head);

		file.pipe(res);

		// Log cuando termina o se corta el stream
		req.on("close", () => {
			const mensajeInfoLog = utilidadesLog.formatInfoLog(
				`El envío del chunk ha terminado (${fileName} [${start}-${end}]) (CLOSE)`,
				`REQUEST(CLOSE)`
			);
			console.log(mensajeInfoLog);
		});

		// Log al etectar cancelación (ej. si el usuario salta en la reproducción)
		req.on("aborted", () => {
			const mensajeInfoLog = utilidadesLog.formatInfoLog(
				`El envío del chunk ha sido interrumpido (${fileName} [${start}-${end}]) (ABORTED)`,
				`REQUEST(ABORTED)`
			);
			console.log(mensajeInfoLog);

			file.destroy();
		});
	} else {
		const tamano = utilidadesArchivo.formatearTamano(fileSize);
		const mensajeInfoLog = utilidadesLog.formatInfoLog(`Sirviendo archivo completo: ${path.basename(filePath)} (${tamano})`,`REQUEST(FULL)`);
		console.log(mensajeInfoLog);

		const head = {
			"Content-Length": fileSize,
			"Content-Type": filePath.endsWith(".mkv")
				? "video/x-matroska"
				: "video/mp4",
		};
		res.writeHead(StatusCodes.OK, head);
		fs.createReadStream(filePath).pipe(res);
	}
});

// Iniciar servidor en todas las interfaces
app.listen(PORT, "0.0.0.0", () => {
	const mensajeInfoLog = utilidadesLog.formatInfoLog(`Addon corriendo en http://localhost:${PORT}/manifest.json`)
	console.log(mensajeInfoLog);

	const mensajeInfoLog2 = utilidadesLog.formatInfoLog(`IP LAN accesible: http://${localIP}:${PORT}/manifest.json`)
	console.log(mensajeInfoLog2);
});

async function obtenerNombreEpisodio(episodio, nTemporada, nEpisodio, nombreCarpetaSerie) {
	const stat = fs.statSync(episodio.path);
	const tamano = utilidadesArchivo.formatearTamano(stat.size);
	const metadatos = await utilidadesArchivo.obtenerMetadatos(episodio.path);
	const resolucion = `${metadatos.height}p`;

	const idiomasAudio = metadatos.idiomas && metadatos.idiomas.audio ? metadatos.idiomas.audio : [];
	const idiomaSubstitulos = metadatos.idiomas && metadatos.idiomas.subtitulos ? metadatos.idiomas.subtitulos : [];

	const numeracionEpisodio = `S${String(nTemporada).padStart(2, "0")} E${String(nEpisodio).padStart(2, "0")}`;

	let nombreCapitulo;
	if(FORMATO_NOMBRE_SIMPLIFICADO) {
		let prefijoAudio;
		if (idiomasAudio.length > 2) prefijoAudio = "Multi";
		else if (idiomasAudio.length === 2) prefijoAudio = "Dual";
		else prefijoAudio = "";

		const audioStr = idiomasAudio.length ? ` [${prefijoAudio}: ${idiomasAudio.map(a => a.toUpperCase()).join("/")}]` : null;
		const subStr = idiomaSubstitulos.length ? `[Sub: ${idiomaSubstitulos.map(s => s.toUpperCase()).join("/")}]` : null;

		nombreCapitulo = `${nombreCarpetaSerie} ${numeracionEpisodio} [${resolucion}] [${tamano}]`;
		if (audioStr) nombreCapitulo += '' + `${audioStr}`;
		if (subStr) nombreCapitulo += '' + ` ${subStr}`;
		nombreCapitulo += `\n💾 ${tamano}`;
	}
	else {
		const audioStr = idiomasAudio.length ? `🔊 ${idiomasAudio.map(a => utilidadesString.toSmallCaps(a)).join(" / ")}` : null;
		const subStr = idiomaSubstitulos.length ? `🔤 ${idiomaSubstitulos.map(s => utilidadesString.toSmallCaps(s)).join(" / ")}` : null;

		nombreCapitulo = `${nombreCarpetaSerie} ${numeracionEpisodio}\n` +
						 `📺 ${resolucion}\n` +
						 `💾 ${tamano}`;
		const idiomasPistas = [audioStr, subStr].filter(Boolean).join(" ");
		if (idiomasPistas) nombreCapitulo += `\n${idiomasPistas}`;
	}

	return nombreCapitulo;
}

