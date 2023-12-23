// Import necessary modules
import { NFTStorage } from "nft.storage";
import fs from "fs/promises"; // Update to use `fs/promises`

const NFT_STORAGE_KEY = "REPLACE_ME_WITH_YOUR_KEY";

async function storeTextNFT(text, name, description) {
  const nftstorage = new NFTStorage({ token: NFT_STORAGE_KEY });

  return nftstorage.store({
    text,
    name,
    description,
  });
}

async function readTextFromFile(filePath) {
  const text = await fs.readFile(filePath, "utf-8");
  return text;
}
