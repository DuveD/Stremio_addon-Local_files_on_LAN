import { createReadStream, existsSync, statSync } from "fs";
import { StatusCodes } from "http-status-codes";
import { basename, resolve, sep } from "path";
import Configuracion from "../configuracion/ConfiguracionAplicacion.js";
import UtilidadesArchivo from "../utilidades/UtilidadesArchivo.js";
import { formatInfoLog, formatWarnLog } from "../utilidades/UtilidadesLog.js";

export async function fileGetEndpoint(req, res) {
	const filePath = decodeURIComponent(req.params.filePath);
	const fileName = basename(filePath);

	// Seguridad: Solo permitir archivos dentro de SERIES_DIR o PELICULAS_DIR
	const absFilePath = resolve(filePath);
	const isInSeries = absFilePath.startsWith(
		resolve(Configuracion.medios.pathCarpetaSeries) + sep
	);
	const isInPeliculas = absFilePath.startsWith(
		resolve(Configuracion.medios.pathCarpetaPeliculas) + sep
	);

	if (!isInSeries && !isInPeliculas) {
		const mensajeWarnLog = formatWarnLog(
			`Intento de acceso a archivo fuera de las carpetas permitidas: ${filePath}`,
			`SECURITY`
		);
		console.warn(mensajeWarnLog);

		return res.status(StatusCodes.FORBIDDEN).send("Acceso denegado.");
	}

	if (!existsSync(filePath))
		return res.status(StatusCodes.NOT_FOUND).send("Archivo no encontrado.");

	const stat = statSync(filePath);
	const fileSize = stat.size;
	const range = req.headers.range;

	const contentType = filePath.endsWith(".mkv")
		? "video/x-matroska"
		: "video/mp4";

	if (range) {
		const parts = range.replace(/bytes=/, "").split("-");
		const start = parseInt(parts[0], 10);
		const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
		const chunkSize = end - start + 1;
		const tamano = UtilidadesArchivo.formatearTamano(chunkSize);

		const mensajeInfoLog = formatInfoLog(
			`El cliente ha solicitado un chunk (${fileName} [${start}-${end}]) (${tamano})`,
			`REQUEST(RANGE)`
		);
		console.log(mensajeInfoLog);

		const file = createReadStream(filePath, { start, end });
		const head = {
			"Content-Range": `bytes ${start}-${end}/${fileSize}`,
			"Accept-Ranges": "bytes",
			"Content-Length": chunkSize,
			"Content-Type": contentType,
		};
		res.writeHead(StatusCodes.PARTIAL_CONTENT, head);

		file.pipe(res);

		// Log cuando termina o se corta el stream
		req.on("close", () => {
			const mensajeInfoLog = formatInfoLog(
				`El envío del chunk ha terminado (${fileName} [${start}-${end}]) (CLOSE)`,
				`REQUEST(CLOSE)`
			);
			console.log(mensajeInfoLog);
		});

		// Log al etectar cancelación (ej. si el usuario salta en la reproducción)
		req.on("aborted", () => {
			const mensajeInfoLog = formatInfoLog(
				`El envío del chunk ha sido interrumpido (${fileName} [${start}-${end}]) (ABORTED)`,
				`REQUEST(ABORTED)`
			);
			console.log(mensajeInfoLog);

			file.destroy();
		});
	} else {
		const tamano = UtilidadesArchivo.formatearTamano(fileSize);
		const mensajeInfoLog = formatInfoLog(
			`Sirviendo archivo completo: ${basename(filePath)} (${tamano})`,
			`REQUEST(FULL)`
		);
		console.log(mensajeInfoLog);

		const head = {
			"Content-Length": fileSize,
			"Content-Type": contentType,
		};
		res.writeHead(StatusCodes.OK, head);
		createReadStream(filePath).pipe(res);
	}
}

export default {
	fileGetEndpoint,
};
