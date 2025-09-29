// Módulos de terceros
const { execFile } = require("child_process");
const ffmpeg = require("fluent-ffmpeg");
ffmpeg.setFfprobePath("ffprobe");

// Módulos locales
const utilidadesLog = require("./UtilidadesLog.js");

const EXTENSION_MKV = ".mkv";

function formatearTamano(bytes) {
	if (bytes === 0) return "0.00 B";

	const units = ["B", "KB", "MB", "GB", "TB", "PB"];
	const i = Math.floor(Math.log(bytes) / Math.log(1024));
	const size = bytes / Math.pow(1024, i);

	return size.toFixed(2) + " " + units[i];
}

async function obtenerMetadatos(filePath) {
	let metadatos = {};

	const resolucion = await obtenerResolucion(filePath);
	if (resolucion) {
		metadatos.width = resolucion.width;
		metadatos.height = resolucion.height;
	} else {
		metadatos.width = null;
		metadatos.height = null;
	}

	if (filePath.endsWith(EXTENSION_MKV)) {
		const idiomas = await obtenerIdiomasPistas(filePath);
		if (idiomas) {
			metadatos.idiomas = { audio: idiomas.audio, subtitulos: idiomas.sub };
		} else {
			metadatos.idiomas = null;
		}
	} else {
		metadatos.idiomas = null;
	}

	return metadatos;
}

function obtenerResolucion(filePath) {
	return new Promise((resolve, reject) => {
		ffmpeg.ffprobe(filePath, (err, metadata) => {
			if (err || !metadata || !metadata.streams) {
				return resolve({
					width: null,
					height: null,
				});
			}
			const stream = metadata.streams.find((s) => s.width && s.height);
			if (stream) {
				resolve({
					width: stream.width,
					height: stream.height,
				});
			} else {
				resolve({
					width: null,
					height: null,
				});
			}
		});
	});
}

function procesarPistas(tracks) {
	const audio = [];
	const sub = [];

	for (const track of tracks) {
		if (track.type === "audio" || track.type === "subtitles") {
			let lang = (track.properties?.language ?? "und").toLowerCase();
			let trackName = (track.properties?.track_name ?? "").toLowerCase();

			// Prioridad: track_name > language
			if (trackName.includes("castellano") || trackName.includes("cast")) {
				lang = "Esp";
			} else if (trackName.includes("latino") || trackName.includes("lat")) {
				lang = "Lat";
			} else if (lang === "spa") {
				lang = "Esp";
			} else if (["esl", "es-la", "lat"].includes(lang)) {
				lang = "Lat";
			} else {
				lang = lang.toUpperCase();
			}

			if (track.type === "audio" && !audio.includes(lang)) {
				audio.push(lang);
			}
			if (track.type === "subtitles" && !sub.includes(lang)) {
				sub.push(lang);
			}
		}
	}

	return { audio, sub };
}

function obtenerIdiomasPistas(filePath) {
	return new Promise((resolve, reject) => {
		const isMKV = filePath.endsWith(EXTENSION_MKV);
		if (!isMKV) return resolve(null);

		const command = "mkvmerge";
		const args = ["-J", filePath];
		const options = { maxBuffer: 1024 * 1024 * 10 };

		execFile(command, args, options, (err, stdout) => {
			if (err) return resolve({ audio: [], sub: [] }); // Si falla, devuelve vacío

			try {
				const json = JSON.parse(stdout);
				const { audio, sub } = procesarPistas(json.tracks);
				resolve({ audio, sub });
			} catch (e) {
				utilidadesLog.logError("Error al parsear JSON de mkvmerge:", e);
				resolve({ audio: [], sub: [] });
			}
		});
	});
}

module.exports = {
	formatearTamano,
	obtenerMetadatos,
	obtenerResolucion,
	obtenerIdiomasPistas,
};
