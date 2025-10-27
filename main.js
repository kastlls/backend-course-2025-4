import { Command } from 'commander';
import http from 'http';
import fs from 'fs/promises';
import { XMLBuilder } from 'fast-xml-parser';

const program = new Command();
program.requiredOption('-i, --input <file>');
program.requiredOption('-h, --host <host>');
program.requiredOption('-p, --port <port>');
program.parse(process.argv);

const options = program.opts();

// Check if input file exists
try {
  await fs.access(options.input);
} catch {
  console.error('Cannot find input file');
  process.exit(1);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${options.host}:${options.port}`);
    const text = await fs.readFile(options.input, 'utf-8');
    
    // Parse JSON line by line
    let cars = text
      .split('\n')              // split file into lines
      .filter(line => line)     // skip empty lines
      .map(line => JSON.parse(line));

    const showCyl = url.searchParams.get('cylinders') === 'true';
    const maxMpg = parseFloat(url.searchParams.get('max_mpg'));
    if (!isNaN(maxMpg)) cars = cars.filter(c => c.mpg < maxMpg);

    const output = cars.map(c => ({
      model: c.model,
      ...(showCyl && { cyl: c.cyl }),
      ...(url.searchParams.get('max_mpg') && { mpg: c.mpg })
    }));

    // Build XML
    const xml = new XMLBuilder({ format: true }).build({ cars: { car: output } });

    // Save XML to file asynchronously (last response log)
    await fs.writeFile('last_response.xml', xml, 'utf-8');

    // Send response to client
    res.writeHead(200, { 'Content-Type': 'application/xml' });
    res.end(xml);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Server error: ' + err.message);
  }
});

server.listen(options.port, options.host, () => {
  console.log(`Server running at http://${options.host}:${options.port}/`);
});
