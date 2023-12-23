// Import necessary modules
import { NFTStorage, File } from "nft.storage";
import mime from "mime";
import fs from "fs/promises"; // Update to use `fs/promises`
import path from "path";

const NFT_STORAGE_KEY = "REPLACE_ME_WITH_YOUR_KEY";

async function storeImageNFT(imagePath, name, description) {
  const image = await fileFromPath(imagePath);
  const nftstorage = new NFTStorage({ token: NFT_STORAGE_KEY });

  return nftstorage.store({
    image,
    name,
    description,
  });
}

async function fileFromPath(filePath) {
  const content = await fs.readFile(filePath);
  const type = mime.getType(filePath);
  return new File([content], path.basename(filePath), { type });
}
