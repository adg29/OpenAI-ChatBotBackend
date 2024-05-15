const { NFTStorage, File } = require("nft.storage");
const FormData = require("form-data");
const { fromBuffer } = require("file-type");

const { ethers } = require("ethers");
const Near8RolePlaying = require("./abi.json");

// Image generation function
const generateImage = async (text) => {
  try {
    const form = new FormData();
    form.append("prompt", text);

    const response = await axios.post(
      "https://clipdrop-api.co/text-to-image/v1",
      form,
      {
        headers: {
          "x-api-key": process.env.IMAGE_API_KEY,
          ...form.getHeaders(),
        },
        responseType: "arraybuffer", // To get binary image data
      }
    );
    return response.data;
  } catch (error) {
    console.log("generateImage error", error);
    throw new Error("Image generation failed");
  }
};

// IPFS upload function
const storeImageNFT = async (imageBuffer, name, description) => {
  try {
    const fileType = await fromBuffer(imageBuffer);
    const image = new File([imageBuffer], "temp.jpg", { type: fileType?.mime });

    console.log("File", image);

    const nftstorage = new NFTStorage({ token: process.env.NFT_STORAGE_KEY });
    const result = await nftstorage.store({
      image,
      name,
      description,
    });
    console.log(result);
    return { metadataUrl: result.url, metadataContent: result.data };
  } catch (error) {
    throw new Error(error);
  }
};

// Set up provider
const provider = new ethers.providers.JsonRpcProvider("YOUR_RPC_PROVIDER_URL");

// Set up signer
const privateKey = "YOUR_PRIVATE_KEY"; // Replace with your private key
const wallet = new ethers.Wallet(privateKey, provider);

// Connect to the contract
const contractAddress = "CONTRACT_ADDRESS"; // Replace with your contract address
const contract = new ethers.Contract(
  contractAddress,
  Near8RolePlaying.abi,
  wallet
);

// mint on-chain
const mintOnChain = async () => {};
