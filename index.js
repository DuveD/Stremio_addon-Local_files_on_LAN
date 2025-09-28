
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

const CONTENT_TYPE_SERIES = "series";
const CONTENT_TYPE_MOVIE = "movie";

// Manifest mínimo para Stremio
const manifest = {
	id: "org.localAddon.localLanStreaming",
	version: "3.0.0",
	name: "Local LAN Streaming",
	description: "Addon para servir contenido almacenado en red local.",
	resources: ["stream"],
	types: [CONTENT_TYPE_SERIES, CONTENT_TYPE_MOVIE],
	idPrefixes: ["tt"],
	behaviorHints: {
		configurable: false,
		configurationRequired: false,
	},
};

const app = express();

// Ruta al archivo series_map.json
const SERIES_MAP_FILE_NAME = "series_map.json";
const SERIES_MAP_FILE = path.join(__dirname, SERIES_MAP_FILE_NAME);
let SERIES_MAP = {};
// Ruta al archivo peliculas_map.json

const PELICULAS_MAP_FILE_NAME = "peliculas_map.json";
const PELICULAS_MAP_FILE = path.join(__dirname, PELICULAS_MAP_FILE_NAME);
let PELICULAS_MAP = {};

// Cargamos variables de entorno
const SERIES_DIR = utilidadesEntorno.cargarVariable("SERIES_DIR");
const PELICULAS_DIR = utilidadesEntorno.cargarVariable("PELICULAS_DIR");
const PORT = utilidadesEntorno.cargarVariable("PORT");
const FORMATO_NOMBRE_SIMPLIFICADO = utilidadesEntorno.cargarVariableBoolean("FORMATO_NOMBRE_SIMPLIFICADO", false);

const localIP = utilidadesRed.obtenerIPLocal();

// Función para cargar series_map.json
function cargarMapa(type) {
	let mapa = null
	let nombreMapa = null;
	let path = null;
	let informarMapGlobal = null;
	if (type === CONTENT_TYPE_SERIES) {
		nombreMapa = SERIES_MAP_FILE_NAME;
		path = SERIES_MAP_FILE;
		informarMapGlobal = (data) => (SERIES_MAP = data);
	} else if (type === CONTENT_TYPE_MOVIE) {
		nombreMapa = PELICULAS_MAP_FILE_NAME;
		path = PELICULAS_MAP_FILE;
		informarMapGlobal = (data) => (PELICULAS_MAP = data);
	}

	try {
		if (fs.existsSync(path)) {
			mapa = JSON.parse(fs.readFileSync(path, "utf8"));
			var nEntradas = Object.keys(mapa).length;

			const mensajeInfoLog = utilidadesLog.formatInfoLog(`${nombreMapa} actualizado: ${nEntradas} entradas.`);
			console.log(mensajeInfoLog);
		} else {
			mapa = {};

			const mensajeWarnLog = utilidadesLog.formatWarnLog(`No existe ${nombreMapa}.`);
			console.warn(mensajeWarnLog);
		}
	} catch (err) {
		mapa = {};

		const mensajeErrorLog = utilidadesLog.formatErrorLog(`Falló la carga de ${nombreMapa}: ${err}`)
		console.error(mensajeErrorLog);
	}
	
	informarMapGlobal(mapa);
}

// Cargar una vez al inicio
cargarMapa(CONTENT_TYPE_SERIES);
cargarMapa(CONTENT_TYPE_MOVIE);

// Buscar episodios por carpeta
function buscarEpisodios(folder) {
	// Seguridad: evitar rutas con ../
	const showPath = path.join(SERIES_DIR, folder);

	// Si no existe la carpeta, devolver array vacío.
	if (!fs.existsSync(showPath)) return [];

	const episodes = [];

	// Buscar carpetas que empiecen por "Season" (case insensitive).
	const seasonDirs = fs
		.readdirSync(showPath)
		.filter((d) => d.toLowerCase().startsWith("season"));

	// Por cada carpeta de temporada, buscar archivos de video.
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

function obtenerCarpetaDesdeIdmdbId(type, imdbId, recargarMapaSiFalla = true) {
	let carpeta = null;

	let mapa = null
	let nombreMapa = null;
	if (type === CONTENT_TYPE_SERIES) {
		nombreMapa = SERIES_MAP_FILE_NAME;
		mapa = SERIES_MAP;
	} else if (type === CONTENT_TYPE_MOVIE) {
		nombreMapa = PELICULAS_MAP_FILE_NAME;
		mapa = PELICULAS_MAP;
	}

	if (mapa) {
		carpeta = Object.keys(mapa).find(f => mapa[f] === imdbId);
	}

	if(carpeta) 
	{
		return carpeta;
	}
	else if(recargarMapaSiFalla) {
		const mensajeWarnLog = utilidadesLog.formatWarnLog(
			`IMDb ID ${imdbId} no encontrado en ${nombreMapa}. Recargando ${nombreMapa}...`
		);
		console.warn(mensajeWarnLog);
		
		cargarMapa(type);
		
		return obtenerCarpetaDesdeIdmdbId(type, imdbId, false);
	}
	else {
		const mensajeWarnLog = utilidadesLog.formatWarnLog(
			`IMDb ID ${imdbId} no encontrado en ${nombreMapa}`
		);
		console.warn(mensajeWarnLog);

		return null;
	}
}

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

	if (type === CONTENT_TYPE_SERIES) {
		const [imdbId, nTemporadaStr, nEpisodioStr] = id.split(":");
		const nTemporada = parseInt(nTemporadaStr);
		const nEpisodio = parseInt(nEpisodioStr);

		let nombreCarpetaSerie = obtenerCarpetaDesdeIdmdbId(type, imdbId);

		if (!nombreCarpetaSerie) {
			const mensajeWarnLog = utilidadesLog.formatWarnLog(
				`IMDb ID ${imdbId} no encontrado en el servidor`,`REQUEST`
			);
			console.warn(mensajeWarnLog);

			return res
				.status(StatusCodes.NOT_FOUND)
				.json({ error: `IMDb ID ${imdbId} no encontrado en el servidor.`});
		} else {
			const episodios = buscarEpisodios(nombreCarpetaSerie);
			const episodio = episodios.find(
				(e) => e.season === nTemporada && e.episode === nEpisodio
			);
			if (episodio) {
				try {
					const nombreEinformacionPelicula = await obtenerNombreEInformacionArchivo(episodio.path, nombreCarpetaSerie, nTemporada, nEpisodio);

					streams.push({
						name: "Local LAN Streaming",
						title: nombreEinformacionPelicula,
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
					`Episodio S${nTemporada}E${nEpisodio} no encontrado en la carpeta ${nombreCarpetaSerie}. `,`REQUEST`
				);
				console.warn(mensajeWarnLog);

				return res.status(StatusCodes.NOT_FOUND).json({
					error: `Episodio S${nTemporada}E${nEpisodio} no encontrado en el servidor.`,
				});
			}
		}
	}
	else if (type === CONTENT_TYPE_MOVIE) {
		const imdbId = id;

		// Aquí tendrías que tener un map similar a SERIES_MAP para películas
		let nombreCarpetaPelicula = obtenerCarpetaDesdeIdmdbId(type, imdbId);

		if (!nombreCarpetaPelicula) {
			const mensajeWarnLog = utilidadesLog.formatWarnLog(
				`IMDb ID ${imdbId} no encontrado en el servidor`,`REQUEST`
			);
			console.warn(mensajeWarnLog);

			return res
				.status(StatusCodes.NOT_FOUND)
				.json({ error: `IMDb ID ${imdbId} no encontrado en el servidor.`});
		}
		else
		{
			// Buscar archivo de video en la carpeta de la película
			const pathCompletoCarpetaPelicula = path.join(PELICULAS_DIR, nombreCarpetaPelicula);
			const pathCarpetaPelicula = fs.readdirSync(pathCompletoCarpetaPelicula);
			const nombreArchivo = pathCarpetaPelicula.find((f) => f.endsWith(".mp4") || f.endsWith(".mkv"));
			const pathCompletoPelicula = path.join(pathCompletoCarpetaPelicula, nombreArchivo);

			const nombreEinformacionPelicula = await obtenerNombreEInformacionArchivo(pathCompletoPelicula, nombreCarpetaPelicula);

			// Si encontramos más de uno, lanzamos error y avisamos al usuario.
			if (!nombreArchivo) {
				const mensajeWarnLog = utilidadesLog.formatWarnLog(
					`No se encontró archivo de video para IMDb ID ${imdbId} en la carpeta ${nombreCarpetaPelicula}.`,`REQUEST`
				);
				console.warn(mensajeWarnLog);
				return res.status(StatusCodes.NOT_FOUND).json({
					error: `No se encontró archivo de video para IMDb ID ${imdbId} en el servidor.`
				});
			}

			const filePath = path.join(PELICULAS_DIR, nombreCarpetaPelicula, nombreArchivo);

			streams.push({
				name: "Local LAN Streaming",
				title: nombreEinformacionPelicula,
				url: `http://${localIP}:${PORT}/file/${encodeURIComponent(filePath)}`
			});
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

async function obtenerNombreEInformacionArchivo(path, nombreCarpeta, nTemporada, nEpisodio) {
	const stat = fs.statSync(path);
	const tamano = utilidadesArchivo.formatearTamano(stat.size);
	const metadatos = await utilidadesArchivo.obtenerMetadatos(path);
	const resolucion = `${metadatos.height}p`;

	const idiomasAudio = metadatos.idiomas && metadatos.idiomas.audio ? metadatos.idiomas.audio : [];
	const idiomaSubstitulos = metadatos.idiomas && metadatos.idiomas.subtitulos ? metadatos.idiomas.subtitulos : [];

	let numeracionEpisodio = null;
	if(nTemporada && nEpisodio)
		numeracionEpisodio = `S${String(nTemporada).padStart(2, "0")} E${String(nEpisodio).padStart(2, "0")}`;

	let nombreCapitulo;
	if(FORMATO_NOMBRE_SIMPLIFICADO) {
		let prefijoAudio;
		if (idiomasAudio.length > 2) prefijoAudio = "Multi";
		else if (idiomasAudio.length === 2) prefijoAudio = "Dual";
		else prefijoAudio = "";

		const audioStr = idiomasAudio.length ? ` [${prefijoAudio}: ${idiomasAudio.map(a => a.toUpperCase()).join("/")}]` : null;
		const subStr = idiomaSubstitulos.length ? `[Sub: ${idiomaSubstitulos.map(s => s.toUpperCase()).join("/")}]` : null;

		nombreCapitulo = `${nombreCarpeta}`;
		if (numeracionEpisodio)
			nombreCapitulo += ` ${numeracionEpisodio}`;
		nombreCapitulo += ` [${resolucion}]`;
		nombreCapitulo += ` [${tamano}]`;
		if (audioStr) nombreCapitulo += '' + `${audioStr}`;
		if (subStr) nombreCapitulo += '' + ` ${subStr}`;
		nombreCapitulo += `\n💾 ${tamano}`;
	}
	else {
		const audioStr = idiomasAudio.length ? `🔊 ${idiomasAudio.map(a => utilidadesString.toSmallCaps(a)).join(" / ")}` : null;
		const subStr = idiomaSubstitulos.length ? `🔤 ${idiomaSubstitulos.map(s => utilidadesString.toSmallCaps(s)).join(" / ")}` : null;

		nombreCapitulo = `${nombreCarpeta}`;
		if (numeracionEpisodio)
			nombreCapitulo += ` ${numeracionEpisodio}`;
		nombreCapitulo += `\n`;
		nombreCapitulo += `📺 ${resolucion}\n`;
		nombreCapitulo += `💾 ${tamano}`;

		const idiomasPistas = [audioStr, subStr].filter(Boolean).join(" ");
		if (idiomasPistas) nombreCapitulo += `\n${idiomasPistas}`;
	}

	return nombreCapitulo;
}