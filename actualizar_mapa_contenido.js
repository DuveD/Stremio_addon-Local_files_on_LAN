const fs = require("fs");

// Parámetros desde FileBot
const imdbId = process.argv[2];
const folderName = process.argv[3];
const dbType = (process.argv[4]) ? process.argv[4].toLowerCase() : "series"; // "Movie" o "Series"

let path = null;
if (dbType === "movie") {
    path = "./mapa_peliculas.json";
} else if (dbType === "series") {
    path = "E:\\Documents\\Stremio\\Stremio_addon-Local_files_on_LAN\\mapa_series.json";
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
