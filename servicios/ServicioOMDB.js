import Configuracion from "../configuracion/ConfiguracionAplicacion.js";

// Parámetros para la búsqueda de títulos en OMDb.
// Cache simple en memoria: Map<imdbId, { value: string|null, expiresAt: number }>
const omdbCache = new Map();

async function obtenerTituloDesdeImdbId(imdbId) {
	if (!imdbId) return null;

	// Normalizar
	imdbId = String(imdbId).trim();

	// Comprueba cache
	const cached = omdbCache.get(imdbId);
	const ahora = Date.now();
	if (cached && cached.expiresAt > ahora) {
		return cached.value; // puede ser string o null
	}

	// Si no hay API key, devolvemos null (para no romper flujo)
	if (!Configuracion.omdb.apiKey) {
		console.warn(
			`OMDb API key no configurada (OMDB_API_KEY). No se consultará OMDb para ${imdbId}.`
		);
		return null;
	}

	const url = `http://www.omdbapi.com/?i=${encodeURIComponent(
		imdbId
	)}&r=json&apikey=${Configuracion.omdb.apiKey}`;

	try {
		// Si usas Node <18 instala node-fetch y cambia fetch por require('node-fetch')
		const res = await fetch(url, { method: "GET" });
		if (!res.ok) {
			console.warn(`OMDb: respuesta no OK para ${imdbId}: ${res.status}`);
			omdbCache.set(imdbId, { value: null, expiresAt: ahora + 1000 * 60 * 5 });
			return null;
		}

		const data = await res.json();

		if (data && data.Response === "True") {
			const title = data.Title || null;
			// Guardar en cache
			omdbCache.set(imdbId, {
				value: title,
				expiresAt: ahora + Configuracion.omdb.cacheTtl,
			});
			return title;
		} else {
			// Cuando OMDb responde { Response: "False", Error: "Movie not found!" }
			const errMsg = data && data.Error ? data.Error : "No encontrado";
			console.warn(`OMDb: ${errMsg} para ${imdbId}`);
			omdbCache.set(imdbId, { value: null, expiresAt: ahora + 1000 * 60 * 30 }); // cache corto
			return null;
		}
	} catch (err) {
		console.error(`Error consultando OMDb para ${imdbId}: ${err}`);
		// cacheeo temporal para evitar reintentos rápidos
		omdbCache.set(imdbId, { value: null, expiresAt: ahora + 1000 * 60 * 5 });
		return null;
	}
}

export default {
	obtenerTituloDesdeImdbId
};