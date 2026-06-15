import { spawn } from 'child_process';
import * as path from 'path';

async function runGenerator() {
  const dbDir = path.resolve(__dirname, '../../../../packages/database');
  console.log('Running drizzle-kit generate in:', dbDir);

  // We set shell: true for correct script execution on Windows
  const child = spawn('npx', ['drizzle-kit', 'generate'], {
    cwd: dbDir,
    stdio: ['pipe', 'pipe', 'inherit'],
    shell: true,
  });

  child.stdout.on('data', (data) => {
    const output = data.toString();
    process.stdout.write(output);

    // If the output asks if an enum was created or renamed
    if (output.includes('enum?')) {
      console.log('\n[Script] Detected enum prompt, sending Enter...');
      child.stdin.write('\r\n');
    }
  });

  child.on('close', (code) => {
    console.log(`\n[Script] Generator process exited with code ${code}`);
    process.exit(code || 0);
  });
}

runGenerator().catch((err) => {
  console.error('Error in script:', err);
  process.exit(1);
});
