import ts from 'typescript';
import type {PublicationFile} from './publication-content';
export const BLOG_LOCALE_MAP_PATH='frontend/config/blog-slugs.ts';
const locales=['en','fr','es'] as const;
const slugPattern=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
function literal(node:ts.Node):string{if(!ts.isStringLiteral(node)||!slugPattern.test(node.text))throw Error('Unsupported blog locale map value');return node.text;}
/** Update the existing browser-safe map using parsed literals only, never model code. */
export function buildPublicationLocaleMap(source:string,files:PublicationFile[]):PublicationFile{
 const slugs:Record<string,string>={};let canonical:string|undefined;
 for(const locale of locales){
  const file=files.find(f=>f.path.startsWith(`content/${locale}/blog/`)&&f.path.endsWith('.mdx'));
  if(!file)throw Error('Missing localized article metadata');
  const value=(key:string)=>JSON.parse(file.content.match(new RegExp(`^${key}: ([^\\n]+)$`,'m'))?.[1]??'null') as unknown;
  const slug=value('slug'),key=value('canonicalSlug');
  if(typeof slug!=='string'||typeof key!=='string'||!slugPattern.test(slug)||!slugPattern.test(key)||file.path!==`content/${locale}/blog/${slug}.mdx`||canonical&&canonical!==key)throw Error('Inconsistent localized article metadata');
  canonical=key;slugs[locale]=slug;
 }
 const parsed=ts.createSourceFile(BLOG_LOCALE_MAP_PATH,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
 const declaration=parsed.statements.filter(ts.isVariableStatement).flatMap(s=>[...s.declarationList.declarations]).find(d=>ts.isIdentifier(d.name)&&d.name.text==='BLOG_SLUGS_BY_CANONICAL');
 let initializer=declaration?.initializer;
 while(initializer&&(ts.isAsExpression(initializer)||ts.isSatisfiesExpression(initializer)||ts.isParenthesizedExpression(initializer)))initializer=initializer.expression;
 if(!initializer||!ts.isObjectLiteralExpression(initializer))throw Error('Unsupported blog locale map structure');
 const seen=new Set<string>();let present=false;
 for(const property of initializer.properties){
  if(!ts.isPropertyAssignment(property)||!ts.isObjectLiteralExpression(property.initializer))throw Error('Unsupported blog locale map entry');
  const key=literal(property.name);if(seen.has(key))throw Error('Duplicate canonical blog slug');seen.add(key);
  const row:Record<string,string>={};
  for(const field of property.initializer.properties){
   if(!ts.isPropertyAssignment(field)||!ts.isIdentifier(field.name)||!locales.includes(field.name.text as typeof locales[number])||row[field.name.text])throw Error('Unsupported localized slug entry');
   row[field.name.text]=literal(field.initializer);
  }
  if(locales.some(l=>!row[l]))throw Error('Incomplete existing locale map');
  if(key===canonical){if(locales.some(l=>row[l]!==slugs[l]))throw Error('Canonical blog slug collision');present=true;}
  else if(locales.some(l=>row[l]===slugs[l]))throw Error('Localized blog slug collision');
 }
 if(present)return {path:BLOG_LOCALE_MAP_PATH,content:source};
 const entry=`\n  ${JSON.stringify(canonical)}: {\n${locales.map(l=>`    ${l}: ${JSON.stringify(slugs[l])},`).join('\n')}\n  },`;
 const offset=initializer.getStart(parsed)+1;
 return {path:BLOG_LOCALE_MAP_PATH,content:source.slice(0,offset)+entry+source.slice(offset)};
}
