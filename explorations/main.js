import { storeImageNFT, fileFromPath } from "./imageUploadScript.js"; // Update with the correct file paths
import { storeTextNFT, readTextFromFile } from "./textUploadScript.js"; // Update with the correct file paths

async function main() {
  // For image upload
  const imagePath = "path/to/image.jpg"; // Update with the actual image path
  const imageName = "Image Name";
  const imageDescription = "Image Description";

  const imageFile = await fileFromPath(imagePath);
  const imageResult = await storeImageNFT(
    imageFile,
    imageName,
    imageDescription
  );
  console.log("Image NFT Uploaded:", imageResult);

  // For text upload
  const textPath = "path/to/textfile.txt"; // Update with the actual text file path
  const textName = "Text Name";
  const textDescription = "Text Description";

  const textContent = await readTextFromFile(textPath);
  const textResult = await storeTextNFT(textContent, textName, textDescription);
  console.log("Text NFT Uploaded:", textResult);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
