// Einstieg für Cloudflare Workers. Konfiguration siehe README.md in diesem Ordner.
import { handleRequest } from './handler.js';

export default {
  /**
   * @param {Request} request
   * @param {import('./handler.js').ProxyEnv} env
   */
  fetch(request, env) {
    return handleRequest(request, env);
  },
};
