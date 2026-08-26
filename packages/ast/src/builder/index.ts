import { BuilderContext, StructuralBlock, BuilderOptions, BuilderError } from './types';
import { ASTNode } from '../types';
import { Pass1Security } from './passes/pass-1-security';
import { Pass2Hierarchy } from './passes/pass-2-hierarchy';
import { Pass3Identity } from './passes/pass-3-identity';
import { Pass4LexoRank } from './passes/pass-4-lexorank';
import { Pass5Relationships } from './passes/pass-5-relationships';
import { Pass6Metadata } from './passes/pass-6-metadata';
import { ASTValidator } from '../validator';
import { ValidationResult } from '../types';

export interface BuildManifest {
  success: boolean;
  nodes: ASTNode[];
  builderErrors: BuilderError[];
  validationResult?: ValidationResult;
  diagnostics: {
    durationMs: number;
    nodeCount: number;
  };
}

export class ASTBuilder {
  static buildAndValidate(blocks: StructuralBlock[], options: BuilderOptions): BuildManifest {
    const start = performance.now();
    const ctx = new BuilderContext(blocks, options);

    // Instantiate pipeline passes
    const passes = [
      new Pass1Security(),
      new Pass2Hierarchy(),
      new Pass3Identity(),
      new Pass4LexoRank(),
      new Pass5Relationships(),
      new Pass6Metadata()
    ];

    // Orchestrate Passes
    for (const pass of passes) {
      try {
        pass.execute(ctx);
      } catch (err: any) {
        ctx.reportError({
          code: 'PASS_EXECUTION_FATAL',
          message: `Pass '${pass.name}' threw an unhandled exception: ${err.message}`
        });
        // Abort pipeline if a pass crashes completely
        break; 
      }
    }

    const astNodes = Pass6Metadata.finalize(ctx);
    
    // Always validate output
    const validationResult = ASTValidator.validate(astNodes);
    
    const end = performance.now();

    return {
      success: ctx.errors.length === 0 && validationResult.valid,
      nodes: astNodes,
      builderErrors: ctx.errors,
      validationResult,
      diagnostics: {
        durationMs: end - start,
        nodeCount: astNodes.length
      }
    };
  }
}

export * from './types';
