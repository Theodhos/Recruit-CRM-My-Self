// The careers site as a plain server: `node serve.mjs` -> http://localhost:3100/jobs  (also what the Docker image runs).
// On Vercel the same handler runs as a function (api/index.mjs). Config: see .env.example.
import { createServer } from 'node:http';

import { handle } from './lib/site.mjs';

const port = Number(process.env.PORT ?? 3100);
createServer(handle).listen(port, process.env.HOST, () => console.log(`Careers page: http://localhost:${port}/jobs`));
