import fs from "fs";
import { StatusCodes } from "http-status-codes";
import { join } from "path";
import Configuracion from "../configuracion/ConfiguracionAplicacion.js";
import Constantes from "../constantes/ConstantesGenerales.js";
import ServicioArchivos from "../servicios/ServicioArchivos.js";
import UtilidadesArchivo from "../utilidades/UtilidadesArchivo.js";
import { formatErrorLog, formatInfoLog, formatWarnLog } from "../utilidades/UtilidadesLog.js";
import UtilidadesString from "../utilidades/UtilidadesString.js";

export async function streamGetEndpoint(req, res) {
    const { type, id } = req.params;

    if (!type || !id) {
        const mensajeWarningLog = formatInfoLog(
            `Parámetros inválidos para la request de stream para ${type} con id: ${id}`,
            `REQUEST`
        );
        console.warn(mensajeWarningLog);

        return res
            .status(StatusCodes.BAD_REQUEST)
            .json({ error: "Parámetros inválidos." });
    }

    const mensajeInfoLog = formatInfoLog(
        `Request de stream para ${type} con id: ${id}`,
        `REQUEST`
    );
    console.log(mensajeInfoLog);

    let streams = [];

    if (type === Constantes.CONTENT_TYPE_SERIES) {
        const [imdbId, nTemporadaStr, nEpisodioStr] = id.split(":");
        const nTemporada = parseInt(nTemporadaStr);
        const nEpisodio = parseInt(nEpisodioStr);

        let nombreCarpetaSerie = await ServicioArchivos.obtenerCarpetaDeIdmdbId(type, imdbId);

        if (!nombreCarpetaSerie) {
            const mensajeWarnLog = formatWarnLog(
                `IMDb ID ${imdbId} no encontrado en el servidor`,
                `REQUEST`
            );
            console.warn(mensajeWarnLog);

            return res
                .status(StatusCodes.NOT_FOUND)
                .json({ error: `IMDb ID ${imdbId} no encontrado en el servidor.` });
        }

        const episodios = buscarEpisodios(nombreCarpetaSerie);
        const episodio = episodios.find(
            (e) => e.season === nTemporada && e.episode === nEpisodio
        );

        if (!episodio) {
            const mensajeWarnLog = formatWarnLog(
                `Episodio S${nTemporada}E${nEpisodio} no encontrado en la carpeta ${nombreCarpetaSerie}. `,
                `REQUEST`
            );
            console.warn(mensajeWarnLog);

            return res.status(StatusCodes.NOT_FOUND).json({
                error: `Episodio S${nTemporada}E${nEpisodio} para el IMDb ID ${imdbId} no encontrado en el servidor.`,
            });
        }

        let nombreEinformacionPelicula;
        try {
            nombreEinformacionPelicula = await obtenerNombreEInformacionArchivo(
                episodio.path,
                nombreCarpetaSerie,
                nTemporada,
                nEpisodio
            );
        } catch (err) {
            const mensajeErrorLog = formatErrorLog(
                `Error al obtener los datos del archivo ${episodio.file}: ${err}`,
                `REQUEST`
            );
            console.error(mensajeErrorLog);

            return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
                error: `No se pudo procesar el archivo del episodio para IMDb ID ${imdbId}.`,
            });
        }

        streams.push({
            name: Configuracion.servidor.nombre,
            title: nombreEinformacionPelicula,
            url: Configuracion.servidor.urlLocal + `/file/${encodeURIComponent(
                episodio.path
            )}`,
        });

        const mensajeInfoLog = formatInfoLog(
            `Episodio encontrado: ${episodio.file}`,
            `REQUEST`
        );
        console.log(mensajeInfoLog);

        res.setHeader("Content-Type", "application/json");
        return res.status(StatusCodes.OK).json({ streams });
    } else if (type === Constantes.CONTENT_TYPE_MOVIE) {
        const imdbId = id;

        // Aquí tendrías que tener un map similar a SERIES_MAP para películas
        let nombreCarpetaPelicula = await ServicioArchivos.obtenerCarpetaDeIdmdbId(type, imdbId);

        if (!nombreCarpetaPelicula) {
            const mensajeWarnLog = formatWarnLog(
                `IMDb ID ${imdbId} no encontrado en el servidor`,
                `REQUEST`
            );
            console.warn(mensajeWarnLog);

            return res
                .status(StatusCodes.NOT_FOUND)
                .json({ error: `IMDb ID ${imdbId} no encontrado en el servidor.` });
        }

        // Buscar archivo de video en la carpeta de la película
        const pathCompletoCarpetaPelicula = join(
            Configuracion.medios.pathCarpetaPeliculas,
            nombreCarpetaPelicula
        );
        const pathCarpetaPelicula = fs.readdirSync(pathCompletoCarpetaPelicula);
        const nombreArchivo = pathCarpetaPelicula.find(
            (f) => f.endsWith(".mp4") || f.endsWith(".mkv")
        );

        if (!nombreArchivo) {
            const mensajeWarnLog = formatWarnLog(
                `No se encontró archivo de video para IMDb ID ${imdbId} en la carpeta ${nombreCarpetaPelicula}.`,
                `REQUEST`
            );
            console.warn(mensajeWarnLog);
            return res.status(StatusCodes.NOT_FOUND).json({
                error: `No se encontró archivo de video para IMDb ID ${imdbId} en el servidor.`,
            });
        }

        let nombreEinformacionPelicula;
        let filePath;
        try {
            const pathCompletoPelicula = join(
                pathCompletoCarpetaPelicula,
                nombreArchivo
            );
            nombreEinformacionPelicula = await obtenerNombreEInformacionArchivo(
                pathCompletoPelicula,
                nombreCarpetaPelicula
            );
            filePath = join(Configuracion.medios.pathCarpetaPeliculas, nombreCarpetaPelicula, nombreArchivo);
        } catch (err) {
            const mensajeErrorLog = formatErrorLog(
                `Error al obtener metadatos del archivo ${nombreArchivo}: ${err}`,
                `REQUEST`
            );
            console.error(mensajeErrorLog);

            return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
                error: `No se pudo procesar el archivo de la película para IMDb ID ${imdbId}.`,
            });
        }

        streams.push({
            name: Configuracion.servidor.nombre,
            title: nombreEinformacionPelicula,
            url: Configuracion.servidor.urlLocal + `/file/${encodeURIComponent(filePath)}`,
        });

        const mensajeInfoLog = formatInfoLog(
            `Película encontrada: ${nombreArchivo}`,
            `REQUEST`
        );
        console.log(mensajeInfoLog);

        res.setHeader("Content-Type", "application/json");
        return res.status(StatusCodes.OK).json({ streams });
    } else {
        return res
            .status(StatusCodes.BAD_REQUEST)
            .json({ error: `Tipo ${type} no soportado.` });
    }
}

async function obtenerNombreEInformacionArchivo(
	path,
	nombreCarpeta,
	nTemporada,
	nEpisodio
) {
	const stat = fs.statSync(path);
	const tamano = UtilidadesArchivo.formatearTamano(stat.size);
	const metadatos = await UtilidadesArchivo.obtenerMetadatos(path);
	const resolucion = `${metadatos.height}p`;

	const idiomasAudio =
		metadatos.idiomas && metadatos.idiomas.audio ? metadatos.idiomas.audio : [];
	const idiomaSubstitulos =
		metadatos.idiomas && metadatos.idiomas.subtitulos
			? metadatos.idiomas.subtitulos
			: [];

	let numeracionEpisodio = null;
	if (nTemporada && nEpisodio)
		numeracionEpisodio = `S${String(nTemporada).padStart(2, "0")} E${String(
			nEpisodio
		).padStart(2, "0")}`;

	let nombreCapitulo;
	if (Configuracion.medios.nombreFormatoSimplificado) {
		let prefijoAudio;
		if (idiomasAudio.length > 2) prefijoAudio = "Multi";
		else if (idiomasAudio.length === 2) prefijoAudio = "Dual";
		else prefijoAudio = "";

		const audioStr = idiomasAudio.length
			? ` [${prefijoAudio}: ${idiomasAudio
					.map((a) => a.toUpperCase())
					.join("/")}]`
			: null;
		const subStr = idiomaSubstitulos.length
			? `[Sub: ${idiomaSubstitulos.map((s) => s.toUpperCase()).join("/")}]`
			: null;

		nombreCapitulo = `${nombreCarpeta}`;
		if (numeracionEpisodio) nombreCapitulo += ` ${numeracionEpisodio}`;
		nombreCapitulo += ` [${resolucion}]`;
		nombreCapitulo += ` [${tamano}]`;
		if (audioStr) nombreCapitulo += `${audioStr}`;
		if (subStr) nombreCapitulo += ` ${subStr}`;
	} else {
		const audioStr = idiomasAudio.length
			? `🔊 ${idiomasAudio
					.map((a) => UtilidadesString.toSmallCaps(a))
					.join(" / ")}`
			: null;
		const subStr = idiomaSubstitulos.length
			? `🔤 ${idiomaSubstitulos
					.map((s) => UtilidadesString.toSmallCaps(s))
					.join(" / ")}`
			: null;

		nombreCapitulo = `${nombreCarpeta}`;
		if (numeracionEpisodio) nombreCapitulo += ` ${numeracionEpisodio}`;
		nombreCapitulo += `\n`;
		nombreCapitulo += `📺 ${resolucion}\n`;
		nombreCapitulo += `💾 ${tamano}`;

		const idiomasPistas = [audioStr, subStr].filter(Boolean).join(" ");
		if (idiomasPistas) nombreCapitulo += `\n${idiomasPistas}`;
	}

	return nombreCapitulo;
}

// Buscar episodios por carpeta
function buscarEpisodios(folder) {
    // Seguridad: evitar rutas con ../
    const showPath = join(Configuracion.medios.pathCarpetaSeries, folder);

    // Si no existe la carpeta, devolver array vacío.
    if (!fs.existsSync(showPath)) return [];

    const episodes = [];

    // Buscar carpetas que empiecen por "Season" (case insensitive).
    const seasonDirs = fs.readdirSync(showPath)
        .filter((d) => d.toLowerCase().startsWith("season"));

    // Por cada carpeta de temporada, buscar archivos de video.
    seasonDirs.forEach((seasonFolder) => {
        const seasonPath = join(showPath, seasonFolder);
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
                    path: join(seasonPath, f),
                });
            });
    });

    return episodes;
}

export default {
    streamGetEndpoint,
};