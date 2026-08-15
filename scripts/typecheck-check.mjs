import { domainInvariants } from "../packages/domain/src/index.mjs";
if (!domainInvariants.serverAuthoritativeState) throw new Error("Domain contract invalid");
process.stdout.write("Domain contract check passed\n");
