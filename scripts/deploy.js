import fs from "node:fs";
import path from "node:path";
import solc from "solc";
import dotenv from "dotenv";
import { ethers } from "ethers";

dotenv.config();

const ROOT = process.cwd();
const SOURCE = path.join(ROOT, "build", "AmbAG.sol");
const ENV = path.join(ROOT, ".env");
const CHAIN_ID = 97;
const RPC_URL = process.env.RPC_URL || "https://data-seed-prebsc-1-s1.bnbchain.org:8545";

function setEnv(key, value) {
  const line = `${key}=${value}`;
  let text = fs.existsSync(ENV) ? fs.readFileSync(ENV, "utf8") : "";
  const pattern = new RegExp(`^${key}=.*$`, "m");
  text = pattern.test(text) ? text.replace(pattern, line) : `${text.replace(/\s*$/, "")}\n${line}\n`;
  fs.writeFileSync(ENV, text);
}

function compile() {
  const content = fs.readFileSync(SOURCE, "utf8");
  const input = {
    language: "Solidity",
    sources: { "AmbAG.sol": { content } },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "paris",
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } }
    }
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = (output.errors || []).filter((e) => e.severity === "error");
  if (errors.length) {
    for (const e of errors) console.error(e.formattedMessage);
    throw new Error("Compilation failed");
  }
  for (const w of (output.errors || []).filter((e) => e.severity === "warning")) {
    console.warn(`warning: ${w.formattedMessage.split("\n")[0]}`);
  }

  const artifact = output.contracts["AmbAG.sol"]["AmbAG"];
  return { abi: artifact.abi, bytecode: `0x${artifact.evm.bytecode.object}` };
}

async function main() {
  console.log(`Compiling build/AmbAG.sol with solc ${solc.version()}...`);
  const { abi, bytecode } = compile();
  console.log(`Compiled. Bytecode ${(bytecode.length - 2) / 2} bytes.`);

  let key = (process.env.DEPLOYER_KEY || "").trim();
  if (!key) {
    const fresh = ethers.Wallet.createRandom();
    setEnv("DEPLOYER_KEY", fresh.privateKey);
    key = fresh.privateKey;
    console.log("\nNo DEPLOYER_KEY found. Generated a throwaway testnet wallet and saved it to .env.");
  }

  const wallet = new ethers.Wallet(key);
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const signer = wallet.connect(provider);

  const network = await provider.getNetwork();
  if (Number(network.chainId) !== CHAIN_ID) {
    throw new Error(`RPC is chain ${network.chainId}, expected ${CHAIN_ID}. Check RPC_URL.`);
  }

  const balance = await provider.getBalance(signer.address);
  console.log(`\nDeployer: ${signer.address}`);
  console.log(`Balance:  ${ethers.formatEther(balance)} tBNB`);

  if (balance === 0n) {
    console.error("\nBLOCKED: the deployer has no tBNB.");
    console.error(`Fund this address on BSC Testnet (chain 97), then rerun: npm run deploy`);
    console.error(`Address: ${signer.address}`);
    console.error(`Faucets: https://www.bnbchain.org/en/testnet-faucet | https://testnet.bnbchain.org/faucet-smart`);
    console.error(`Explorer: https://testnet.bscscan.com/address/${signer.address}`);
    process.exit(2);
  }

  console.log("\nDeploying...");
  const factory = new ethers.ContractFactory(abi, bytecode, signer);
  const contract = await factory.deploy();
  const tx = contract.deploymentTransaction();
  console.log(`Deploy tx: ${tx.hash}`);
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  const receipt = await tx.wait();
  const cost = receipt.gasUsed * receipt.gasPrice;

  setEnv("CONTRACT_ADDRESS", address);

  const artifactPath = path.join(ROOT, "build", "AmbAG.artifact.json");
  fs.writeFileSync(artifactPath, JSON.stringify({ address, abi, chainId: CHAIN_ID, txHash: tx.hash }, null, 2));

  console.log(`\nDeployed at: ${address}`);
  console.log(`Gas used:    ${receipt.gasUsed} (cost ${ethers.formatEther(cost)} tBNB)`);
  console.log(`Explorer:    https://testnet.bscscan.com/address/${address}`);
  console.log(`Written to .env as CONTRACT_ADDRESS and to build/AmbAG.artifact.json`);
  console.log(`\nNext: verify at https://testnet.bscscan.com/verifyContract (compiler 0.8.19, optimization on, 200 runs), then: npm run seed`);
}

main().catch((err) => {
  console.error(`\n${err?.shortMessage || err?.message || err}`);
  process.exit(1);
});
