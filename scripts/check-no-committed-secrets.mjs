import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const hash = value => crypto.createHash('sha256').update(value).digest('hex');
export const canonicalSourceSHA256 = bytes => hash(bytes.toString('utf8').replace(/\r\n/g, '\n'));
function entropy(value) {
  const counts = new Map();
  for (const c of value) counts.set(c, (counts.get(c) || 0) + 1);
  return [...counts.values()].reduce((sum, count) => sum - (count / value.length) * Math.log2(count / value.length), 0);
}

// Values stay in memory; exact reviewed exceptions contain fingerprints only.
export function inspectText(content) {
  const found = [];
  const stats = { bytesScanned: 0, excludedHashOrIntegrity: 0, environmentReferences: 0 };
  function add(_source, key, value, provider, kind, offset = 0) {
    if (!value || value.length > 65536) return;
    found.push({ key, fingerprint: hash(Buffer.from(value, 'utf8')), provider, kind,
      line: content.slice(0, offset).split('\n').length });
  }
const strong=[
 ['Google/Gemini API key',/\bAIza[0-9A-Za-z_-]{35}\b/g],
 ['GitHub PAT',/\b(?:gh[pousr]_[A-Za-z0-9]{36,255}|github_pat_[A-Za-z0-9_]{50,255})\b/g],
 ['OpenAI/Anthropic API key',/\bsk-(?:proj-|ant-api\d+-)?[A-Za-z0-9_-]{20,255}\b/g],
 ['AWS access-key identifier',/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g],
 ['Stripe secret key',/\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,255}\b/g],
 ['Slack token',/\bxox[baprs]-[0-9A-Za-z-]{15,255}\b/g],
 ['HTTP authorization credential', /\b(?:Bearer|Basic)\s+([A-Za-z0-9+_\/=.-]{20,})/g],
 ['JWT literal',/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g]
];
function scan(buf,src){
 stats.bytesScanned+=buf.length;let binary=buf.subarray(0,Math.min(buf.length,16384)).includes(0);
 let t=buf.toString('utf8');src._text=t;
 if(src.kind==='BLOB'){if(binary)stats.binaryBlobs++;else stats.textBlobs++;}
 for(const[p,re]of strong){re.lastIndex=0;for(const x of t.matchAll(re))add(src,'TOKEN_PREFIX',x[1]||x[0],p,'STRONG',x.index);}
 const pem=/-----BEGIN ((?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY)-----[\s\S]{10,20000}?-----END \1-----/g;
 for(const x of t.matchAll(pem))add(src,'PRIVATE_KEY',x[0],'Private key material','STRONG',x.index);
 const conn=/(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis(?:s)?|amqp(?:s)?):\/\/(?:[^\/\s:@"']+)?(?::([^@\s\/"']+))?@[^\/\s"'`]+/g;
 for(const x of t.matchAll(conn)){if(x[1]){let v=x[1];try{v=decodeURIComponent(v)}catch{}add(src,'CONNECTION_URL_PASSWORD',v,'Database/cache/queue password','CONNECTION',x.index);}}
 const query=/[?&](api[_-]?key|access[_-]?token|secret|token)=([^&\s"'<>]+)/gi;
 for(const x of t.matchAll(query))add(src,x[1],x[2],'Credential in URL query','GENERIC',x.index);
 if(!binary){
  let pos=0;for(const line of t.split('\n')){
   let a=line.match(/^\s*(?:(?:export|const|let|var)\s+)?["']?([A-Za-z_][A-Za-z0-9_.-]*)["']?\s*[:=]\s*(.{1,4096})/);
   if(a&&/(password|passwd|pwd|secret|api.?key|access.?key|private.?key|token|database.?url|redis.?url|connection.?string|authorization)/i.test(a[1])&&!/(?:expires|expiry|ttl|max|limit|enabled|length|status|count|timeout|algorithm|duration|name|header)$/i.test(a[1])){
    let rest=a[2].trim(),v=null;if(/^['"]/.test(rest)){let q=rest.match(/^(['"])(.*?)\1/);if(q)v=q[2];}else if(!/[(){}\[\]]/.test(rest)&&!rest.startsWith('process.')&&!rest.startsWith('config.')&&!rest.startsWith('this.'))v=rest.replace(/\s+#.*$/,'').replace(/[,;]\s*$/,'').trim();
    if(v&&v.length>=3&&!/^(?:true|false|null|undefined|boolean|string|number)$/.test(v)&&!/^https?:\/\/[^@]*$/.test(v)&&!v.includes('://')){
     if(/\$\{|^\{\{|^process\.env|^secrets\./.test(v)){stats.environmentReferences++;}
     else if(a[1].match(/public|client.?id/i)){add(src,a[1],v,'Public identifier','FALSE',pos);}
     else add(src,a[1],v,'Named credential/secret','GENERIC',pos);
    }
   }
   const quotes=/(?<![A-Za-z0-9])(["'])([A-Za-z0-9+_\/=-]{24,256})\1/g;
   for(const q of line.matchAll(quotes)){
    let v=q[2];
    const hex=/^[a-f0-9]{32,128}$/i.test(v);
    const hashField=/^\s*"(?:authoritativeAdjudicationSHA256|fileSHA256|fingerprint|inlineSchemaHash)"\s*:/.test(line);
    if((hex&&v.length!==64)||(hex&&hashField)||/sha(?:256|384|512)-/i.test(line)||/\bintegrity\b|\bchecksum\b|\bsha256\b/i.test(line)){stats.excludedHashOrIntegrity++;continue;}
    if(hex&&v.length===64)add(src,'UNCLASSIFIED_HEX_LITERAL',v,'Unclassified 64-hex literal','ENTROPY',pos+q.index);
    if(entropy(v)>4.2&&/[a-z]/i.test(v)&&/[0-9]/.test(v))add(src,'HIGH_ENTROPY_QUOTED_LITERAL',v,'Unclassified high-entropy literal','ENTROPY',pos+q.index);
   }
   pos+=line.length+1;
  }
 }
 delete src._text;
 return binary;
}

  scan(Buffer.from(content, 'utf8'), { kind: 'CURRENT_TREE' });
  return found;
}

export function isReviewed(finding, file, fileSHA256, baseline) {
  return baseline.entries.some(entry =>
    entry.file === file && entry.fileSHA256 === fileSHA256 &&
    entry.fingerprint === finding.fingerprint && entry.line === finding.line &&
    entry.key === finding.key && typeof entry.reason === 'string' && entry.reason.length > 20);
}

// Prisma 5.22 getUniquePackageName hashes the unexpanded datamodel text.
// Only this one JSON field's entropy finding is explained; every other rule
// and every other byte in the generated client remains subject to scanning.
export function inspectFile(content, file, generatedSchema) {
  const findings = inspectText(content);
  if (file !== 'packages/infrastructure/src/prisma-client/package.json' || typeof generatedSchema !== 'string') return findings;
  let metadata;
  try { metadata = JSON.parse(content); } catch { return findings; }
  if (!metadata || Array.isArray(metadata) || typeof metadata.name !== 'string' ||
      !/^prisma-client-[0-9a-f]{64}$/.test(metadata.name) ||
      metadata.name !== 'prisma-client-' + hash(Buffer.from(generatedSchema, 'utf8'))) return findings;
  // Require the generator's exact first-property representation, and reject
  // duplicate/nested name keys rather than accepting ambiguous JSON evidence.
  const prefix = content.match(/^\{\r?\n  "name": "(prisma-client-[0-9a-f]{64})",?\r?\n/);
  if (!prefix || prefix[1] !== metadata.name || [...content.matchAll(/"name"\s*:/g)].length !== 1) return findings;
  return findings.filter(finding => !(finding.key === 'HIGH_ENTROPY_QUOTED_LITERAL' &&
    finding.kind === 'ENTROPY' && finding.line === 2 && finding.fingerprint === hash(metadata.name)));
}

export function checkCurrentTree(repo = process.cwd()) {
  const git = process.platform === 'win32' ? 'C:/Program Files/Git/cmd/git.exe' : 'git';
  const readGit = args => execFileSync(git, ['--no-optional-locks', '-c', 'core.fsmonitor=false', '-C', repo, ...args],
    { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
      env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_NO_LAZY_FETCH: '1', GIT_TERMINAL_PROMPT: '0' } });
  const baseline = JSON.parse(fs.readFileSync(path.join(repo, '.security/secret-review-baseline.json'), 'utf8'));
  if (baseline.schema !== 'StudyAI-exact-reviewed-noncredential-baseline-v1') throw new Error('Unqualified baseline schema');
  const gitlinks = readGit(['ls-files', '--stage', '-z']).split('\0')
    .filter(row => row.startsWith('160000 ')).map(row => row.slice(row.indexOf('\t') + 1));
  const files = [...new Set(readGit(['ls-files', '--cached', '--others', '--exclude-standard', '-z']).split('\0').filter(Boolean))];
  const unresolved = [];
  const generatedPrismaFiles = [];
  let inspected = 0;
  for (const file of files) {
    if (gitlinks.includes(file)) continue; // Git-mode 160000 is a separate object boundary.
    const full = path.join(repo, file);
    if (!fs.existsSync(full)) continue; // Tracked deletion: no current bytes.
    const stat = fs.lstatSync(full);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Non-ordinary source object');
    const bytes = fs.readFileSync(full);
    inspected++;
    if (file.startsWith('packages/infrastructure/src/prisma-client/')) generatedPrismaFiles.push(file);
    let generatedSchema;
    if (file === 'packages/infrastructure/src/prisma-client/package.json') {
      const schemaPath = path.join(repo, 'packages/infrastructure/src/prisma-client/schema.prisma');
      const schemaStat = fs.lstatSync(schemaPath);
      if (!schemaStat.isFile() || schemaStat.isSymbolicLink()) throw new Error('Non-ordinary generated schema');
      generatedSchema = fs.readFileSync(schemaPath, 'utf8');
    }
    for (const finding of inspectFile(bytes.toString('utf8'), file, generatedSchema)) {
      if (!isReviewed(finding, file, canonicalSourceSHA256(bytes), baseline)) unresolved.push({ file, ...finding });
    }
  }
  return { inspected, gitlinks, unresolved, generatedPrismaFiles };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = checkCurrentTree();
  if (result.unresolved.length) {
    console.error(JSON.stringify({ result: 'FAIL', unresolved: result.unresolved }, null, 2));
    process.exitCode = 1;
  } else console.log(JSON.stringify({ result: 'PASS', inspected: result.inspected,
    gitlinkCount: result.gitlinks.length, generatedPrismaFiles: result.generatedPrismaFiles,
    unresolved: 0, rawValuesPrinted: false }));
}
