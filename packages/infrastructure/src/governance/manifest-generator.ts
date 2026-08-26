import { Project, SyntaxKind } from 'ts-morph';
import fs from 'fs';
import path from 'path';

export function generateManifest() {
  const project = new Project();
  
  // Add all source files manually to avoid relying on a specific tsconfig
  project.addSourceFilesAtPaths([
    'packages/**/*.ts',
    'apps/**/*.ts',
    '!**/node_modules/**',
    '!**/dist/**'
  ]);

  const manifest = {
    modules: [] as any[],
    services: [] as any[],
    dependencies: [] as any[],
    capabilities: [] as any[],
    versions: {} as Record<string, any>,
    registrations: [] as any[],
    ownership: {} as Record<string, any>,
    frameworkBindings: [] as any[]
  };

  const sourceFiles = project.getSourceFiles();

  for (const sourceFile of sourceFiles) {
    const filePath = sourceFile.getFilePath();
    
    // Look for service registrations in bootstrap.ts
    if (filePath.endsWith('bootstrap.ts')) {
      const classDec = sourceFile.getClass('InfrastructureBootstrap');
      if (classDec) {
        const method = classDec.getMethod('boot');
        if (method) {
          const calls = method.getDescendantsOfKind(SyntaxKind.CallExpression);
          for (const call of calls) {
            const propAccess = call.getExpressionIfKind(SyntaxKind.PropertyAccessExpression);
            if (propAccess && propAccess.getName() === 'register') {
              const args = call.getArguments();
              if (args.length >= 2) {
                const token = args[0].getText().replace(/['"]/g, '');
                manifest.registrations.push({ token, file: filePath });
                manifest.services.push(token);
              }
            }
          }
        }
      }
    }

    // Look for Modules
    const classes = sourceFile.getClasses();
    for (const cls of classes) {
      const decorators = cls.getDecorators();
      for (const dec of decorators) {
        if (dec.getName() === 'Module') {
          manifest.modules.push({
            name: cls.getName(),
            file: filePath
          });
          manifest.frameworkBindings.push({
            module: cls.getName(),
            framework: 'NestJS'
          });
        }
      }
    }
  }

  const outDir = path.resolve(process.cwd(), '.governance');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  fs.writeFileSync(
    path.join(outDir, 'architecture-manifest.json'),
    JSON.stringify(manifest, null, 2)
  );
  
  // Governance Summary Report
  const summary = `# Governance Architecture Summary\n
## Modules Registered\n${manifest.modules.map((m: any) => `- ${m.name}`).join('\n')}

## Services Registered in Composition\n${manifest.services.map((s: any) => `- ${s}`).join('\n')}

## Framework Bindings\n${manifest.frameworkBindings.map((f: any) => `- ${f.module} -> ${f.framework}`).join('\n')}
`;
  
  fs.writeFileSync(
    path.join(outDir, 'governance-summary.md'),
    summary
  );

  console.log('Architectural Manifest & Reports Generated Successfully in .governance/');
}

generateManifest();
