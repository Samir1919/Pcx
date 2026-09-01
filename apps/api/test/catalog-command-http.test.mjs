import assert from "node:assert/strict";
import test from "node:test";
import { CatalogCommandError } from "../src/modules/catalog/catalog-command-service.mjs";
import { createRequestHandler } from "../src/server.mjs";

const origin="https://pcx.example";
function service(overrides={}){return{async createCategory(_a,input){return{id:"c1",...input,status:"ACTIVE"};},async createBrand(_a,input){return{id:"b1",...input,status:"ACTIVE"};},async createProductModel(_a,input){return{id:"m1",...input,status:"ACTIVE"};},async update(_a,_kind,id,input){return{id,...input,status:"ACTIVE"};},async archive(){},async remove(){},...overrides};}
async function invoke(path,{method="POST",body={},headers={},catalogCommandService=service()}={}){const result={headers:{}};const response={setHeader(n,v){result.headers[n]=v;},writeHead(s){result.status=s;return response;},end(v){result.body=v?JSON.parse(v):undefined;return response;}};const payload=JSON.stringify(body);const request={url:path,method,headers:{origin,"content-type":"application/json",cookie:"pcx_access=access; pcx_csrf=csrf","x-csrf-token":"csrf","x-request-id":"admin-request",...headers},async *[Symbol.asyncIterator](){if(payload)yield Buffer.from(payload);}};await createRequestHandler({catalogCommandService,allowedOrigins:new Set([origin])})(request,response);return result;}

test("admin catalog collections create server-owned records without reflecting access",async()=>{
  for(const [path,input] of [["categories",{name:"GPU",slug:"gpu"}],["brands",{name:"Brand",slug:"brand"}],["product-models",{categoryId:"c",brandId:"b",name:"Model",slug:"model"}]]){const response=await invoke(`/api/v1/admin/${path}`,{body:input});assert.equal(response.status,201);assert.equal(response.body.data.status,"ACTIVE");assert.equal(JSON.stringify(response.body).includes("access"),false);}
});
test("admin DELETE archives through command service and returns no body",async()=>{let call;const response=await invoke("/api/v1/admin/product-models/m1",{method:"DELETE",catalogCommandService:service({async archive(...args){call=args;}})});assert.equal(response.status,204);assert.equal(response.body,undefined);assert.deepEqual(call.slice(0,3),["access","product_model","m1"]);});
test("admin DELETE ?purge=1 hard-deletes through the remove method",async()=>{let call;const response=await invoke("/api/v1/admin/brands/b1?purge=1",{method:"DELETE",catalogCommandService:service({async remove(...args){call=args;}})});assert.equal(response.status,204);assert.deepEqual(call.slice(0,3),["access","brand","b1"]);});
test("admin DELETE ?purge=1 maps in_use to 409 and rejects other query params",async()=>{assert.equal((await invoke("/api/v1/admin/brands/b1?purge=1",{method:"DELETE",catalogCommandService:service({async remove(){throw new CatalogCommandError("in_use");}})})).status,409);assert.equal((await invoke("/api/v1/admin/brands/b1?foo=1",{method:"DELETE"})).status,400);assert.equal((await invoke("/api/v1/admin/brands/b1?purge=0",{method:"DELETE"})).status,400);});
test("admin PATCH updates allow-listed fields through protected service",async()=>{let call;const response=await invoke("/api/v1/admin/brands/b1",{method:"PATCH",body:{name:"New"},catalogCommandService:service({async update(...args){call=args;return{id:"b1",name:"New",status:"ACTIVE"};}})});assert.equal(response.status,200);assert.deepEqual(call.slice(0,4),["access","brand","b1",{name:"New"}]);});
test("admin catalog writes fail closed for authz, CSRF, origin, mass assignment, and conflicts",async()=>{
  assert.equal((await invoke("/api/v1/admin/brands",{headers:{origin:"https://evil.example"}})).status,403);
  assert.equal((await invoke("/api/v1/admin/brands",{headers:{"x-csrf-token":"bad"}})).status,403);
  for(const [code,status] of [["forbidden",403],["invalid_input",422],["invalid_reference",422],["conflict",409],["not_found",404]]){const response=await invoke("/api/v1/admin/categories",{catalogCommandService:service({async createCategory(){throw new CatalogCommandError(code);}})});assert.equal(response.status,status);}
  assert.equal((await invoke("/api/v1/admin/categories",{catalogCommandService:null})).status,503);
  assert.equal((await invoke("/api/v1/admin/categories",{method:"GET"})).status,405);
});
test("admin catalog internal errors do not leak",async()=>{const response=await invoke("/api/v1/admin/categories",{catalogCommandService:service({async createCategory(){throw new Error("database secret");}})});assert.equal(response.status,500);assert.equal(JSON.stringify(response.body).includes("database secret"),false);});
