/*
 * Copyright (C) 2025 Stremio Addon Local Files on LAN
 *
 * Este programa es software libre: puedes redistribuirlo y/o modificarlo
 * bajo los términos de la Licencia Pública General GNU publicada por la
 * Free Software Foundation, ya sea la versión 3 de la Licencia, o
 * (a tu elección) cualquier versión posterior.
 *
 * Este programa se distribuye con la esperanza de que sea útil,
 * pero SIN NINGUNA GARANTÍA; incluso sin la garantía implícita de
 * COMERCIABILIDAD o IDONEIDAD PARA UN PROPÓSITO PARTICULAR. Consulta
 * la Licencia Pública General GNU para más detalles.
 *
 * Deberías haber recibido una copia de la Licencia Pública General GNU
 * junto con este programa. Si no, consulta <https://www.gnu.org/licenses/>.
 */

import Dotenv from "dotenv";
import express from "express";
import { StatusCodes } from "http-status-codes";
import Configuracion from "./configuracion/ConfiguracionAplicacion.js";
import Constantes from "./constantes/ConstantesGenerales.js";
import { fileGetEndpoint } from "./controladores/ControladorFile.js";
import { streamGetEndpoint } from "./controladores/ControladorStream.js";
import packageJson from './package.json' with { type: 'json' };
import { formatInfoLog } from "./utilidades/UtilidadesLog.js";

Dotenv.config();
const app = express();
Configuracion.init();

const PORT = Configuracion.servidor.puerto;

// Manifest mínimo para Stremio
const manifest = {
	id: "org.stremioAddon.localFilesOnLan",
	version: packageJson.version,
	name: Configuracion.servidor.nombre,
	description: packageJson.description,
	resources: ["stream"],
	types: [
		Constantes.CONTENT_TYPE_SERIES,
		Constantes.CONTENT_TYPE_MOVIE
	],
	idPrefixes: ["tt"],
	behaviorHints: {
		configurable: false,
		configurationRequired: false,
	}
};

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
app.use((__req, _res, next) => {
	//const formatedUrl = decodeURIComponent(req.url);
	//const mensajeInfoLog = utilidadesLog.formatInfoLog(`(${req.method}) ${formatedUrl}`,`REQUEST`);
	//console.log(mensajeInfoLog);

	next();
});

app.get("/manifest.json", (_req, res) => {
	const mensajeInfoLog = formatInfoLog(
		`Se solicitó el manifest`,
		`REQUEST`
	);
	console.log(mensajeInfoLog);

	res.setHeader("Content-Type", "application/json");
	res.end(JSON.stringify(manifest));
});

// Endpoint de streams
app.get("/stream/:type/:id.json", streamGetEndpoint);

// Endpoint de archivos con soporte de chunks
app.get("/file/:filePath", fileGetEndpoint);

// Iniciar servidor en todas las interfaces
const server = app.listen(PORT, "0.0.0.0", () => {
	const mensajeInfoLog = formatInfoLog(
		`Addon corriendo en http://localhost:${PORT}/manifest.json`,
		`START`
	);
	console.log(mensajeInfoLog);

	const mensajeInfoLog2 = formatInfoLog(
		`IP LAN accesible: ${Configuracion.servidor.urlLocal}/manifest.json`,
		`START`
	);
	console.log(mensajeInfoLog2);
});