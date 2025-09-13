import serveStatic from 'serve-static'
import history from 'connect-history-api-fallback'

export default function spaFallback() {
  return {
    name: 'spa-fallback',
    configureServer(server) {
      // Use connect-history-api-fallback middleware
      server.middlewares.use(history({
        logger: console.log,
        disableDotRule: true,
        htmlAcceptHeaders: ['text/html', 'application/xhtml+xml'],
      }))

      // Serve static files
      server.middlewares.use(serveStatic(server.config.root))
    }
  }
}