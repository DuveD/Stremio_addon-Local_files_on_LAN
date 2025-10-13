import fs from "fs";
import Configuracion from "../configuracion/ConfiguracionAplicacion.js";
import Constantes from "../constantes/ConstantesGenerales.js";

// Parámetros desde FileBot
const imdbId = process.argv[2];
const folderName = process.argv[3];
const dbType = process.argv[4];

if (!dbType) {
    console.error("Tipo desconocido, no se puede determinar la ruta del archivo.");
    process.exit(1);
}

dbType = dbType.toLowerCase();

let path = null;
if (dbType === Constantes.CONTENT_TYPE_MOVIE) {
    path = Configuracion.medios.pathMapaPeliculas;
} else if (dbType === Constantes.CONTENT_TYPE_SERIES) {
    path = Configuracion.medios.pathMapaSeries;
}

if (!path) {
    console.error("Tipo desconocido, no se puede determinar la ruta del archivo.");
    process.exit(1);
}

// Leer JSON existente o inicializar vacío
let data = {};
if (fs.existsSync(path)) {
    try {
        data = JSON.parse(fs.readFileSync(path, "utf-8"));
    } catch (err) {
        console.error("Error leyendo JSON:", err);
        process.exit(1);
    }
}

// Evitar duplicados
if (data.hasOwnProperty(imdbId)) {
    console.log(`Entrada ya existe: ${imdbId} -> ${data[imdbId].name}`);
} else {
    // Añadir nueva entrada
    data[imdbId] = {
        name: folderName,
        type: type
    };

    // Ordenar por clave
    // const sortedData = Object.fromEntries(
    //     Object.entries(data).sort((a, b) => a[0].localeCompare(b[0]))
    // );

    // Guardar JSON actualizado
    fs.writeFileSync(path, JSON.stringify(sortedData, null, 2), "utf-8");
    console.log(`Añadido: ${imdbId} -> ${folderName} (${type})`);
}
