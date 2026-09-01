import { timingSafeEqual } from "node:crypto";
import { AuthenticationError } from "../identity/auth-service.mjs";
import { CatalogCommandError } from "./catalog-command-service.mjs";

const paths = new Map([["categories", "category"], ["brands", "brand"], ["product-models", "product_model"]]);
function send(response, status, body) { response.writeHead(status).end(body == null ? undefined : JSON.stringify(body)); }
function failure(code, message, requestId) { return { error: { code, message, requestId } }; }
function cookies(request) { const result = {}; for (const part of (request.headers?.cookie ?? "").split(";")) { const index = part.indexOf("="); if (index > 0) try { result[part.slice(0,index).trim()] = decodeURIComponent(part.slice(index+1).trim()); } catch {} } return result; }
function security(request, allowedOrigins, parsed) {
  if (typeof request.headers?.origin !== "string" || !allowedOrigins?.has(request.headers.origin)) throw new CatalogCommandError("origin_denied");
  const header = request.headers?.["x-csrf-token"];
  const cookie = parsed.pcx_csrf;
  if (typeof header !== "string" || header.length > 256 || typeof cookie !== "string") throw new CatalogCommandError("csrf_invalid");
  const left = Buffer.from(header), right = Buffer.from(cookie);
  if (left.length !== right.length || !timingSafeEqual(left,right)) throw new CatalogCommandError("csrf_invalid");
}
async function body(request) {
  if (request.headers?.["content-type"]?.split(";",1)[0].trim().toLowerCase() !== "application/json") throw new CatalogCommandError("invalid_request");
  const chunks=[]; let size=0;
  for await (const chunk of request) { const bytes=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk); size+=bytes.length; if(size>16*1024) throw new CatalogCommandError("invalid_request"); chunks.push(bytes); }
  try { const value=JSON.parse(Buffer.concat(chunks).toString("utf8")); if(!value||typeof value!=="object"||Array.isArray(value)) throw new Error(); return value; } catch { throw new CatalogCommandError("invalid_request"); }
}
function mapped(error) {
  if (error instanceof AuthenticationError && error.code === "invalid_access") return [401,"UNAUTHENTICATED","Authentication required"];
  if (!(error instanceof CatalogCommandError)) return [500,"INTERNAL_ERROR","Unexpected server error"];
  const values={ forbidden:[403,"FORBIDDEN","Operation is not allowed"], origin_denied:[403,"ORIGIN_DENIED","Request origin is not allowed"], csrf_invalid:[403,"CSRF_INVALID","CSRF validation failed"], not_found:[404,"CATALOG_NOT_FOUND","Catalog record not found"], conflict:[409,"CATALOG_CONFLICT","Catalog record conflicts with existing data"], in_use:[409,"CATALOG_IN_USE","Catalog record is still referenced and cannot be deleted"], invalid_reference:[422,"INVALID_REFERENCE","Catalog reference is invalid"], invalid_request:[400,"INVALID_REQUEST","Catalog request is invalid"], invalid_input:[422,"INVALID_INPUT","Catalog values are invalid"] };
  return values[error.code] ?? [500,"INTERNAL_ERROR","Unexpected server error"];
}

export async function handleCatalogCommandRequest(request,response,{ catalogCommandService,allowedOrigins,requestId }) {
  const url=new URL(request.url,"http://pcx.local"), prefix="/api/v1/admin/";
  if(!url.pathname.startsWith(prefix)) return false;
  const parts=url.pathname.slice(prefix.length).split("/");
  const kind=paths.get(parts[0]);
  if(!kind || parts.length>2 || (parts.length===2 && !parts[1])) return false;
  if(!catalogCommandService){send(response,503,failure("CATALOG_ADMIN_UNAVAILABLE","Catalog administration is temporarily unavailable",requestId));return true;}
  const purge = request.method === "DELETE" && url.searchParams.get("purge") === "1";
  const keys = [...url.searchParams.keys()];
  if (keys.length > 0 && !(keys.length === 1 && keys[0] === "purge" && purge)) { send(response,400,failure("INVALID_REQUEST","Query parameters are not supported",requestId)); return true; }
  const create=parts.length===1 && request.method==="POST", update=parts.length===2 && request.method==="PATCH", archive=parts.length===2 && request.method==="DELETE" && !purge, remove=parts.length===2 && request.method==="DELETE" && purge;
  if(!create&&!update&&!archive&&!remove){send(response,405,failure("METHOD_NOT_ALLOWED","Method not allowed",requestId));return true;}
  const parsed=cookies(request);
  try {
    security(request,allowedOrigins,parsed);
    const context={requestId};
    if(create){ const method=kind==="category"?"createCategory":kind==="brand"?"createBrand":"createProductModel"; send(response,201,{data:await catalogCommandService[method](parsed.pcx_access,await body(request),context)}); }
    else { let id; try{id=decodeURIComponent(parts[1]);}catch{id=null;} if(!id||id.includes("/")||id.length>128) throw new CatalogCommandError("not_found"); if(update) send(response,200,{data:await catalogCommandService.update(parsed.pcx_access,kind,id,await body(request),context)}); else if(remove) { await catalogCommandService.remove(parsed.pcx_access,kind,id,context); send(response,204); } else { await catalogCommandService.archive(parsed.pcx_access,kind,id,context); send(response,204); } }
  } catch(error){const [status,code,message]=mapped(error);send(response,status,failure(code,message,requestId));}
  return true;
}
