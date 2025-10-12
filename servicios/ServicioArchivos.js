import fs from "fs";
import path from "path";
import Configuracion from "../configuracion/ConfiguracionAplicacion.js";
import Constantes from "../constantes/ConstantesGenerales.js";
import { formatInfoLog, formatWarnLog } from "../utilidades/UtilidadesLog.js";

// Servicios.

async function obtenerCarpetaDeIdmdbId(
    type,
    imdbId,
    recargarMapaSiFalla = true
) {
    let carpeta = null;

    let mediaPath = null;
    let nombreMapa = null;
    if (type === Constantes.CONTENT_TYPE_SERIES) {
        mediaPath = Configuracion.medios.pathCarpetaSeries;
        nombreMapa = Configuracion.medios.pathMapaSeries;
    } else if (type === Constantes.CONTENT_TYPE_MOVIE) {
        mediaPath = Configuracion.medios.pathCarpetaPeliculas;
        nombreMapa = Configuracion.medios.pathMapaPeliculas;
    }

    carpeta = Configuracion.medios.obtenerCarpetaDeMapa(type, imdbId);

    if (carpeta) {
        return carpeta;
    } else if (recargarMapaSiFalla) {
        const mensajeWarnLog = formatWarnLog(
            `IMDb ID ${imdbId} no encontrado en '${nombreMapa}'. Recargando '${nombreMapa}'...`
        );
        console.warn(mensajeWarnLog);

        Configuracion.medios.cargarMapa(type);

        return await obtenerCarpetaDeIdmdbId(type, imdbId, false);
    } else {
        const mensajeWarnLog = formatWarnLog(
            `IMDb ID ${imdbId} no encontrado en '${nombreMapa}'. Buscando el id ${imdbId} en omdbapi...`
        );
        console.warn(mensajeWarnLog);

        const tituloIdmdb = await servicioOMDB.obtenerTituloDesdeImdbId(imdbId);

        if (tituloIdmdb) {
            let pathLocal = path.join(mediaPath, tituloIdmdb);
            if (fs.existsSync(pathLocal)) {
                const mensajeInfoLog = formatInfoLog(
                    `IMDb ID ${imdbId} encontrado en el servidor por título: '${tituloIdmdb}'`
                );
                console.log(mensajeInfoLog);

                Configuracion.medios.agregarSerieDesdeImdb(type, imdbId, tituloIdmdb);

                return tituloIdmdb;
            } else {
                const mensajeWarnLog = formatWarnLog(
                    `IMDb ID ${imdbId} con título '${tituloIdmdb}' no encontrado en el servidor.`
                );
                console.warn(mensajeWarnLog);
                return null;
            }
        } else {
            const mensajeWarnLog = formatWarnLog(
                `IMDb ID ${imdbId} no encontrado en '${nombreMapa}'`
            );
            console.warn(mensajeWarnLog);

            return null;
        }
    }
}

export default {
    obtenerCarpetaDeIdmdbId
};