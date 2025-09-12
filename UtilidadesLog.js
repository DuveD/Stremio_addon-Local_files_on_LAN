
// Función para obtener y formatear fecha y hora.
function obtenerFechaHoraLog() {
    const now = new Date();
    return now.toISOString().replace("T", " ").substring(0, 19);
}

function logInfo(message) {
    console.log(`[${obtenerFechaHoraLog()}][INFO] ${message}`);
}

function logWarn(message) {
    console.warn(`[${obtenerFechaHoraLog()}][WARN] ${message}`);
}

function logError(message) {
    console.error(`[${obtenerFechaHoraLog()}][ERROR] ${message}`);
}

module.exports = {
    logInfo,
    logWarn,
    logError
};