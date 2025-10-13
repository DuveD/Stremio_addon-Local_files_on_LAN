import fs from "fs";
import os from "os";
import { Constantes } from "../constantes/ConstantesGenerales.js";
import { cargarVariable, cargarVariableBoolean } from "../utilidades/UtilidadesEntorno.js";
import { formatErrorLog, formatInfoLog, formatWarnLog } from "../utilidades/UtilidadesLog.js";
import UtilidadesRed from "../utilidades/UtilidadesRed.js";

// Configuración Servidor.
const PUERTO_SERVIDOR = cargarVariable("SERVER_PORT");
const HOSTNAME = os.hostname();
const NOMBRE_ADDON = "Local Files on LAN" + (HOSTNAME ? ` [${HOSTNAME}]` : "")
const IP_LOCAL = UtilidadesRed.obtenerIPLocal();

// Configuración medios.
const PATH_CARPETA_SERIES = cargarVariable("PATH_CARPETA_SERIES");
const PATH_CARPETA_PELICULAS = cargarVariable("PATH_CARPETA_PELICULAS");

const NOMBRE_MAPA_SERIES = cargarVariable("NOMBRE_MAPA_SERIES");
const PATH_MAPA_SERIES = cargarVariable("PATH_MAPA_SERIES");
let MAPA_SERIES = {};

const NOMBRE_MAPA_PELICULAS = cargarVariable("NOMBRE_MAPA_PELICULAS");
const PATH_MAPA_PELICULAS = cargarVariable("PATH_MAPA_PELICULAS");
let MAPA_PELICULAS = {};

const NOMBRE_FORMATO_SIMPLIFICADO = cargarVariableBoolean(
  "FORMATO_NOMBRE_SIMPLIFICADO",
  false
);

// Configuración cache OMDB.
const OMDB_API_KEY = cargarVariable("OMDB_API_KEY");
const OMDB_CACHE_TTL = 1000 * 60 * 60 * 6; // 6 horas

function init() {
  cargarMapa(Constantes.CONTENT_TYPE_SERIES);
  cargarMapa(Constantes.CONTENT_TYPE_MOVIE);
}

// Función para cargar series_map.json
function cargarMapa(type) {
  let nombreMapa = null;
  let mediaPath = null;
  let informarMapGlobal = null;
  if (type === Constantes.CONTENT_TYPE_SERIES) {
    nombreMapa = NOMBRE_MAPA_SERIES;
    mediaPath = PATH_MAPA_SERIES + "/" + NOMBRE_MAPA_SERIES;
    informarMapGlobal = (data) => (MAPA_SERIES = data);
  } else if (type === Constantes.CONTENT_TYPE_MOVIE) {
    nombreMapa = NOMBRE_MAPA_PELICULAS;
    mediaPath = PATH_MAPA_PELICULAS + "/" + NOMBRE_MAPA_PELICULAS;
    informarMapGlobal = (data) => (MAPA_PELICULAS = data);
  }

  let mapa = null;
  try {
    if (fs.existsSync(mediaPath)) {
      mapa = JSON.parse(fs.readFileSync(mediaPath, "utf8"));
      var nEntradas = Object.keys(mapa).length;

      const mensajeInfoLog = formatInfoLog(
        `'${nombreMapa}' actualizado: ${nEntradas} entradas.`
      );
      console.log(mensajeInfoLog);
    } else {
      mapa = {};

      const mensajeWarnLog = formatWarnLog(
        `No existe '${nombreMapa}'.`
      );
      console.warn(mensajeWarnLog);
    }
  } catch (err) {
    mapa = {};

    const mensajeErrorLog = formatErrorLog(
      `Falló la carga de '${nombreMapa}': ${err}`
    );
    console.error(mensajeErrorLog);
  }

  informarMapGlobal(mapa);
}

function obtenerCarpetaDeMapa(type, imdbId) {
  if (type === Constantes.CONTENT_TYPE_SERIES)
    return MAPA_SERIES[imdbId];
  else if (type === Constantes.CONTENT_TYPE_MOVIE)
    return MAPA_PELICULAS[imdbId];
  else
    return null;
}

async function agregarSerieAMapa(type, imdbId, nombreCarpeta) {
  let nombreMapa = null;
  let agregarSerie = null;
  if (type === CONTENT_TYPE_SERIES) {
    nombreMapa = configuracion.medios.pathMapaSeries;
    agregarSerie = (imdbId, nombreCarpeta) =>
      (SERIES_MAP[imdbId] = nombreCarpeta);
  } else if (type === CONTENT_TYPE_MOVIE) {
    nombreMapa = configuracion.medios.pathMapaPeliculas;
    agregarSerie = (imdbId, nombreCarpeta) =>
      (PELICULAS_MAP[imdbId] = nombreCarpeta);
  }

  try {
    let seriesMap = {};
    if (fs.existsSync(nombreMapa)) {
      seriesMap = JSON.parse(fs.readFileSync(nombreMapa, "utf8"));
    }

    if (seriesMap[imdbId]) {
      const mensajeInfoLog = formatInfoLog(
        `El imdbId ${imdbId} ya existe en el mapa '${nombreMapa}', no se añadirá de nuevo.`,
        `IMDB`
      );
      console.log(mensajeInfoLog);

      return false;
    }

    seriesMap[imdbId] = nombreCarpeta;
    fs.writeFileSync(nombreMapa, JSON.stringify(seriesMap, null, 2), "utf8");

    agregarSerie(imdbId, nombreCarpeta);

    const mensajeInfoLog = formatInfoLog(
      `Se ha añadido la entrada "${nombreCarpeta}" : "${imdbId}" al mapa '${nombreMapa}'.`,
      `IMDB`
    );
    console.log(mensajeInfoLog);

    return true;
  } catch (err) {
    const mensajeErrorLog = formatInfoLog(
      `Error al añadir la entrada "${nombreCarpeta}" : "${imdbId}" al mapa '${nombreMapa}': ${err}`,
      `IMDB`
    );
    console.error(mensajeErrorLog);

    return false;
  }
}

export default {
  init,
  servidor: {
    puerto: PUERTO_SERVIDOR,
    nombreHost: HOSTNAME,
    ip: IP_LOCAL,
    nombre: NOMBRE_ADDON,
    urlLocal: `http://${IP_LOCAL}:${PUERTO_SERVIDOR}`
  },
  medios: {
    pathCarpetaSeries: PATH_CARPETA_SERIES,
    pathCarpetaPeliculas: PATH_CARPETA_PELICULAS,
    pathMapaSeries: PATH_MAPA_SERIES + "/" + NOMBRE_MAPA_SERIES,
    seriesMap: MAPA_SERIES,
    pathMapaPeliculas: PATH_MAPA_PELICULAS + "/" + NOMBRE_MAPA_PELICULAS,
    peliculasMap: MAPA_PELICULAS,
    nombreFormatoSimplificado: NOMBRE_FORMATO_SIMPLIFICADO,
    cargarMapa,
    agregarSerieAMapa,
    obtenerCarpetaDeMapa
  },
  omdb: {
    apiKey: OMDB_API_KEY,
    cacheTtl: OMDB_CACHE_TTL
  }
};
