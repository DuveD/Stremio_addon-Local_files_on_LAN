import os from "os";

// Función para obtener IP Local.
function obtenerIPLocal() {
    const nets = os.networkInterfaces();

    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            if (net.family === "IPv4" && !net.internal) return net.address;
        }
    }

    return "127.0.0.1";
}

export default {
    obtenerIPLocal
};

